<?php

namespace App\Modules\Hr\Import;

use App\Models\HrPersonalFile;
use App\Models\HrVipImportBatch;
use App\Models\LeaveBalance;
use App\Models\LeaveLedgerEntry;
use App\Models\LeavePayrollImpact;
use App\Models\LeaveRequest;
use App\Models\LeaveTypeBalance;
use App\Models\Payslip;
use App\Models\User;
use App\Modules\Leave\Services\LeavePolicyService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class HrVipImportCommitService
{
    public function __construct(private readonly LeavePolicyService $leavePolicy) {}

    /**
     * @param  array<string, mixed>  $staged
     * @return array<string, int|list<string>>
     */
    public function commit(HrVipImportBatch $batch, User $actor, array $staged): array
    {
        $policy = $this->leavePolicy->activePolicyForTenant($actor->tenant_id);
        $codeToUser = [];

        return DB::transaction(function () use ($staged, $actor, $policy, &$codeToUser): array {
            $employeesCreated = 0;
            $employeesUpdated = 0;
            $legacyProfilesCreated = 0;

            $employeeRows = [];
            foreach ($staged['employees'] ?? [] as $row) {
                $code = (string) ($row['employee_code'] ?? '');
                if ($code !== '') {
                    $employeeRows[$code] = $row;
                }
            }

            // Every code referenced anywhere in the pack must get an employee record — a code
            // present only in leave/payroll data (e.g. a legacy employee absent from the current
            // master) must never be silently dropped; it becomes a reviewed legacy profile instead.
            $allCodes = collect([$staged['leave_balances'] ?? [], $staged['leave_transactions'] ?? [],
                $staged['leave_provision'] ?? [], $staged['payslips'] ?? [], $staged['remuneration'] ?? [],
                $staged['twelve_month'] ?? [],
            ])->flatten(1)->pluck('employee_code')->filter()->unique()
                ->merge(array_keys($employeeRows))->unique()->values();

            foreach ($allCodes as $code) {
                $row = $employeeRows[$code] ?? null;
                $isLegacyOnly = $row === null;
                $status = $row['employment_status'] ?? [];
                $isOldTermination = ($status['old_termination'] ?? false)
                    || (($status['terminated'] ?? false) && ! ($status['active'] ?? false));

                $user = User::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->where('employee_number', $code)
                    ->first();

                $email = $user?->email ?? $this->syntheticEmail($code, $actor->tenant_id);
                $payload = [
                    'name' => $row['display_name'] ?? $code,
                    'email' => $email,
                    'employee_number' => $code,
                    'date_of_birth' => $row['birth_date'] ?? null,
                    // Every imported identity starts with login disabled regardless of source
                    // status — the Main System Administrator remains the only enabled login
                    // immediately after migration (instruction §3).
                    'account_status' => User::STATUS_DISABLED,
                    'is_active' => false,
                ];

                if ($user) {
                    $user->update($payload);
                    $employeesUpdated++;
                } else {
                    $user = User::create(array_merge($payload, [
                        'tenant_id' => $actor->tenant_id,
                        // Unusable placeholder — never disclosed, never emailed, no invitation
                        // is sent. Login is blocked via account_status regardless of this value.
                        'password' => Hash::make(Str::random(64)),
                        'classification' => 'UNCLASSIFIED',
                    ]));
                    $employeesCreated++;
                    if ($isLegacyOnly) {
                        $legacyProfilesCreated++;
                    }
                }

                $employmentStatus = match (true) {
                    $isLegacyOnly => 'historical_only',
                    $isOldTermination => 'terminated',
                    ($status['active'] ?? true) => 'active',
                    default => 'unknown_historical',
                };

                HrPersonalFile::updateOrCreate(
                    ['tenant_id' => $actor->tenant_id, 'employee_id' => $user->id],
                    [
                        'created_by' => $actor->id,
                        'staff_number' => $code,
                        'payroll_number' => $code,
                        'id_passport_number' => $row['id_number'] ?? null,
                        'date_of_birth' => $row['birth_date'] ?? null,
                        'employment_status' => $employmentStatus,
                        'file_status' => $isLegacyOnly ? 'legacy_review' : 'active',
                    ],
                );

                $codeToUser[$code] = $user->id;
            }

            $ledgerRows = 0;
            foreach ($staged['leave_transactions'] ?? [] as $tx) {
                $userId = $codeToUser[$tx['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                $leaveType = $this->normaliseLeaveType((string) $tx['leave_type']);
                $leaveTypeModel = $this->leavePolicy->leaveType($actor->tenant_id, $leaveType);
                $reference = $tx['ref_no'] ?? null;

                // Idempotent on business identity: same employee+type+date+reference is the
                // same historical movement, never a second deduction (instruction §9).
                $existing = LeaveLedgerEntry::query()
                    ->where('tenant_id', $actor->tenant_id)
                    ->where('user_id', $userId)
                    ->where('leave_type', $leaveType)
                    ->where('effective_date', $tx['from_date'])
                    ->where('source_type', 'hr_vip_import_historical')
                    ->where('reference', $reference)
                    ->exists();
                if ($existing) {
                    continue;
                }

                LeaveRequest::create([
                    'tenant_id' => $actor->tenant_id,
                    'requester_id' => $userId,
                    'leave_type' => $leaveType,
                    'start_date' => $tx['from_date'],
                    'end_date' => $tx['to_date'],
                    'status' => 'approved',
                    'reason' => $tx['reason'] ?? 'Imported from Sage VIP (historical)',
                    'submitted_at' => $tx['from_date'],
                    'approved_at' => $tx['from_date'],
                ]);
                // HISTORICAL_IMPORT, not LEAVE_TAKEN: this is evidence already reflected in the
                // imported closing-balance snapshot (leave_balances/leave_provision), not a fresh
                // deduction. Any ledger-sum balance calculation must exclude this transaction_type.
                LeaveLedgerEntry::create([
                    'tenant_id' => $actor->tenant_id,
                    'user_id' => $userId,
                    'leave_type_id' => $leaveTypeModel?->id,
                    'policy_version_id' => $policy->id,
                    'leave_type' => $leaveType,
                    'transaction_type' => LeaveLedgerEntry::HISTORICAL_IMPORT,
                    'amount' => $tx['taken_days'],
                    'unit' => 'days',
                    'effective_date' => $tx['from_date'],
                    'source_type' => 'hr_vip_import_historical',
                    'reference' => $reference,
                    'reason' => $tx['reason'] ?? null,
                    'recorded_by' => $actor->id,
                ]);
                $ledgerRows++;
            }

            // The leave_balances/leave_provision parsers don't currently capture the source
            // report's own pay-period header (a real gap — flagged for a follow-up parser
            // change), so the batch's period is derived from the most reliable date actually
            // present: a payslip's parsed "Pay Period" end date. This still removes the previous
            // literal-2026 hardcoding that made the importer a one-off, single-month script.
            $periodEndSource = collect($staged['payslips'] ?? [])->pluck('period_end')->filter()->first();
            $periodEnd = $periodEndSource ? \Illuminate\Support\Carbon::parse($periodEndSource) : now();
            $year = (int) $periodEnd->year;
            $periodStart = $periodEnd->copy()->startOfMonth()->toDateString();
            $periodEndDate = $periodEnd->copy()->endOfMonth()->toDateString();

            $balanceRows = 0;
            foreach ($staged['leave_balances'] ?? [] as $bal) {
                $userId = $codeToUser[$bal['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                $rawCode = (string) $bal['leave_code'];
                $leaveType = $this->normaliseLeaveType($rawCode);
                $leaveTypeModel = $this->leavePolicy->leaveType($actor->tenant_id, $leaveType);

                // Full-precision, per-type snapshot — every leave type from the source report,
                // not just annual, and never rounded to a whole day.
                LeaveTypeBalance::updateOrCreate(
                    ['tenant_id' => $actor->tenant_id, 'user_id' => $userId, 'leave_type' => $leaveType, 'period_year' => $year],
                    [
                        'leave_type_id' => $leaveTypeModel?->id,
                        'entitlement' => $bal['entitlement'],
                        'balance_brought_forward' => $bal['balance_bf'],
                        'accrued' => $bal['accrued'],
                        'taken' => $bal['taken'],
                        'balance_carried_forward' => $bal['balance_cf'],
                        'source' => 'hr_vip_import',
                        'imported_at' => now(),
                    ],
                );
                $balanceRows++;

                // The legacy leave_balances table (annual + sick only, integer precision) is kept
                // in sync for any existing code still reading it directly, rounded only there.
                if ($leaveType === 'annual') {
                    LeaveBalance::updateOrCreate(
                        ['user_id' => $userId, 'period_year' => $year],
                        ['annual_balance_days' => (float) $bal['balance_cf']],
                    );
                } elseif ($leaveType === 'sick') {
                    LeaveBalance::updateOrCreate(
                        ['user_id' => $userId, 'period_year' => $year],
                        ['sick_leave_used_days' => (float) $bal['taken']],
                    );
                }
            }

            $provisionRows = 0;
            foreach ($staged['leave_provision'] ?? [] as $prov) {
                $userId = $codeToUser[$prov['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                // updateOrCreate on the natural key (tenant+user+period) rather than create():
                // re-running the same import must not stack duplicate provision snapshots.
                LeavePayrollImpact::updateOrCreate(
                    [
                        'tenant_id' => $actor->tenant_id,
                        'user_id' => $userId,
                        'leave_type' => 'provision',
                        'start_date' => $periodStart,
                        'end_date' => $periodEndDate,
                    ],
                    [
                        'pay_treatment' => 'provision_snapshot',
                        'status' => 'imported',
                        'payload' => $prov,
                    ],
                );
                $provisionRows++;
            }

            $payslipRows = 0;
            foreach ($staged['payslips'] ?? [] as $slip) {
                $userId = $codeToUser[$slip['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                $slipPeriod = ! empty($slip['period_end']) ? \Illuminate\Support\Carbon::parse($slip['period_end']) : $periodEnd;
                $gross = $slip['gross_pay'] ?? collect($slip['earnings'] ?? [])->sum('amount');
                $net = $slip['net_pay'] ?? null;
                Payslip::updateOrCreate(
                    [
                        'tenant_id' => $actor->tenant_id,
                        'user_id' => $userId,
                        'period_month' => (int) $slipPeriod->month,
                        'period_year' => (int) $slipPeriod->year,
                    ],
                    [
                        'gross_amount' => $gross,
                        'net_amount' => $net ?? $gross,
                        'currency' => 'NAD',
                        'employment_type' => Payslip::EMPLOYMENT_TYPE_LOCAL,
                        'period_end_date' => $slip['period_end'],
                        'details' => [
                            'source' => 'sage_vip',
                            'earnings' => $slip['earnings'] ?? [],
                            'deductions' => $slip['deductions'] ?? [],
                            'twelve_month' => collect($staged['twelve_month'] ?? [])
                                ->firstWhere('employee_code', $slip['employee_code']),
                            'remuneration' => collect($staged['remuneration'] ?? [])
                                ->firstWhere('employee_code', $slip['employee_code']),
                        ],
                        'issued_at' => now(),
                    ],
                );
                $payslipRows++;
            }

            return [
                'employees_created' => $employeesCreated,
                'employees_updated' => $employeesUpdated,
                'legacy_profiles_created' => $legacyProfilesCreated,
                'leave_transactions' => $ledgerRows,
                'leave_balances' => $balanceRows,
                'leave_provision' => $provisionRows,
                'payslips' => $payslipRows,
            ];
        });
    }

    private function syntheticEmail(string $code, int $tenantId): string
    {
        $slug = Str::lower(preg_replace('/[^a-zA-Z0-9]+/', '.', $code) ?? $code);

        return "{$slug}.t{$tenantId}@hr-import.invalid";
    }

    private function normaliseLeaveType(string $raw): string
    {
        $upper = strtoupper($raw);

        return match (true) {
            str_contains($upper, 'ANN') => 'annual',
            str_contains($upper, 'SICK') => 'sick',
            // Check COPEN before COMP: COPEN_LV (compensatory) is a distinct leave type from
            // COMP_LVE (compassionate) — instruction §6 requires both preserved, not collapsed.
            str_contains($upper, 'COPEN') => 'compensatory',
            str_contains($upper, 'COMP') => 'compassionate',
            str_contains($upper, 'PAT') => 'paternity',
            str_contains($upper, 'STUD') => 'study',
            str_contains($upper, 'HOME') => 'home',
            str_contains($upper, 'LIL') => 'lil',
            str_contains($upper, 'MAT') => 'maternity',
            default => 'special',
        };
    }
}
