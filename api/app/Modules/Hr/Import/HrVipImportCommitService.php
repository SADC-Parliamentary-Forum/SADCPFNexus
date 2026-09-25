<?php

namespace App\Modules\Hr\Import;

use App\Models\HrPersonalFile;
use App\Models\HrVipImportBatch;
use App\Models\LeaveBalance;
use App\Models\LeaveLedgerEntry;
use App\Models\LeavePayrollImpact;
use App\Models\LeaveRequest;
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

            foreach ($staged['employees'] ?? [] as $row) {
                $code = (string) ($row['employee_code'] ?? '');
                if ($code === '') {
                    continue;
                }
                $status = $row['employment_status'] ?? [];
                if (($status['old_termination'] ?? false) || (($status['terminated'] ?? false) && ! ($status['active'] ?? false))) {
                    continue;
                }

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
                    'account_status' => User::STATUS_DISABLED,
                    'is_active' => false,
                ];

                if ($user) {
                    $user->update($payload);
                    $employeesUpdated++;
                } else {
                    $user = User::create(array_merge($payload, [
                        'tenant_id' => $actor->tenant_id,
                        'password' => Hash::make(Str::random(64)),
                        'classification' => 'UNCLASSIFIED',
                    ]));
                    $employeesCreated++;
                }

                HrPersonalFile::updateOrCreate(
                    ['tenant_id' => $actor->tenant_id, 'employee_id' => $user->id],
                    [
                        'created_by' => $actor->id,
                        'staff_number' => $code,
                        'payroll_number' => $code,
                        'id_passport_number' => $row['id_number'] ?? null,
                        'date_of_birth' => $row['birth_date'] ?? null,
                        'employment_status' => ($status['active'] ?? true) ? 'active' : 'inactive',
                        'file_status' => 'active',
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
                LeaveRequest::create([
                    'tenant_id' => $actor->tenant_id,
                    'requester_id' => $userId,
                    'leave_type' => $leaveType,
                    'start_date' => $tx['from_date'],
                    'end_date' => $tx['to_date'],
                    'status' => 'approved',
                    'reason' => $tx['reason'] ?? 'Imported from Sage VIP',
                    'submitted_at' => $tx['from_date'],
                    'approved_at' => $tx['from_date'],
                ]);
                LeaveLedgerEntry::create([
                    'tenant_id' => $actor->tenant_id,
                    'user_id' => $userId,
                    'policy_version_id' => $policy->id,
                    'leave_type' => $leaveType,
                    'transaction_type' => LeaveLedgerEntry::LEAVE_TAKEN,
                    'amount' => $tx['taken_days'],
                    'unit' => 'days',
                    'effective_date' => $tx['from_date'],
                    'source_type' => 'hr_vip_import',
                    'reference' => $tx['ref_no'] ?? null,
                    'reason' => $tx['reason'] ?? null,
                    'recorded_by' => $actor->id,
                ]);
                $ledgerRows++;
            }

            $balanceRows = 0;
            $year = 2026;
            foreach ($staged['leave_balances'] ?? [] as $bal) {
                $userId = $codeToUser[$bal['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                if (str_contains(strtoupper($bal['leave_code']), 'ANN')) {
                    LeaveBalance::updateOrCreate(
                        ['user_id' => $userId, 'period_year' => $year],
                        ['annual_balance_days' => (int) round((float) $bal['balance_cf'])],
                    );
                    $balanceRows++;
                }
            }

            $provisionRows = 0;
            foreach ($staged['leave_provision'] ?? [] as $prov) {
                $userId = $codeToUser[$prov['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                LeavePayrollImpact::create([
                    'tenant_id' => $actor->tenant_id,
                    'user_id' => $userId,
                    'leave_type' => 'provision',
                    'start_date' => '2026-09-01',
                    'end_date' => '2026-09-30',
                    'pay_treatment' => 'provision_snapshot',
                    'status' => 'imported',
                    'payload' => $prov,
                ]);
                $provisionRows++;
            }

            $payslipRows = 0;
            foreach ($staged['payslips'] ?? [] as $slip) {
                $userId = $codeToUser[$slip['employee_code']] ?? null;
                if (! $userId) {
                    continue;
                }
                $gross = $slip['gross_pay'] ?? collect($slip['earnings'] ?? [])->sum('amount');
                $net = $slip['net_pay'] ?? null;
                Payslip::updateOrCreate(
                    [
                        'tenant_id' => $actor->tenant_id,
                        'user_id' => $userId,
                        'period_month' => 9,
                        'period_year' => 2026,
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
        if (str_contains($upper, 'ANN')) {
            return 'annual';
        }
        if (str_contains($upper, 'SICK')) {
            return 'sick';
        }
        if (str_contains($upper, 'COMP') || str_contains($upper, 'COPEN')) {
            return 'special';
        }

        return 'special';
    }
}
