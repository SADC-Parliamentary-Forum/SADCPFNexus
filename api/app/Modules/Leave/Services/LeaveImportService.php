<?php

namespace App\Modules\Leave\Services;

use App\Models\AuditLog;
use App\Models\LeaveBalance;
use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\User;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LeaveImportService
{
    public const MAX_ROWS = 500;

    public const TEMPLATE_CSV = "record_type,email,leave_type,start_date,end_date,reason,status,annual_days,lil_hours,year\nleave,staff@example.org,annual,2025-01-06,2025-01-10,Historical annual leave,approved,,,\nbalance,staff@example.org,annual,,,,,18,0,2026\n";

    public function __construct(
        private readonly LeavePolicyService $policyService,
        private readonly LeaveCalendarService $calendarService,
        private readonly LeaveBalanceService $balanceService,
    ) {}

    /** @return array{rows: list<array<string, mixed>>, errors: list<array{row:int, message:string}>, created:int, skipped:int, balances:int} */
    public function import(UploadedFile $file, User $actor, bool $commit): array
    {
        $this->assertCanImport($actor);

        $parsed = $this->parseCsv($file);
        $users = User::query()
            ->where('tenant_id', $actor->tenant_id)
            ->get(['id', 'name', 'email', 'tenant_id'])
            ->keyBy(fn (User $user) => strtolower((string) $user->email));

        $policy = $this->policyService->activePolicyForTenant($actor->tenant_id);
        $errors = [];
        $prepared = [];

        foreach ($parsed as $index => $raw) {
            $rowNumber = $index + 2;
            try {
                $prepared[] = $this->normaliseRow($raw, $users, $policy->id, $actor, $rowNumber);
            } catch (ValidationException $e) {
                $errors[] = [
                    'row' => $rowNumber,
                    'message' => collect($e->errors())->flatten()->first() ?: 'Invalid row.',
                ];
            }
        }

        $result = [
            'rows' => array_map(fn (array $row) => $row['preview'], $prepared),
            'errors' => $errors,
            'created' => 0,
            'skipped' => 0,
            'balances' => 0,
        ];

        if ($errors === []) {
            $seen = [];
            foreach ($prepared as &$row) {
                if ($row['kind'] === 'balance') {
                    $result['balances']++;
                    $row['preview']['duplicate'] = false;
                    continue;
                }

                $key = implode('|', [
                    (string) $row['requester']->id,
                    $row['leave_type'],
                    $row['start_date'],
                    $row['end_date'],
                ]);
                $duplicate = isset($seen[$key])
                    || $this->leaveExists($row['requester'], $row['leave_type'], $row['start_date'], $row['end_date']);
                $seen[$key] = true;
                $row['duplicate'] = $duplicate;
                $row['preview']['duplicate'] = $duplicate;
                if ($duplicate) {
                    $result['skipped']++;
                } else {
                    $result['created']++;
                }
            }
            unset($row);
            $result['rows'] = array_map(fn (array $row) => $row['preview'], $prepared);
        }

        if ($errors !== [] || ! $commit) {
            return $result;
        }

        DB::transaction(function () use ($prepared, $actor, $policy) {
            foreach ($prepared as $row) {
                if ($row['kind'] === 'balance') {
                    $this->applyBalance($row, $actor, $policy->id);
                    continue;
                }
                if (! empty($row['duplicate'])) {
                    continue;
                }
                $this->storeLeave($row, $actor, $policy->id);
            }
        });

        AuditLog::record('leave.bulk_imported', [
            'new_values' => [
                'created' => $result['created'],
                'skipped' => $result['skipped'],
                'balances' => $result['balances'],
            ],
            'tags' => 'leave',
        ]);

        return $result;
    }

    private function assertCanImport(User $actor): void
    {
        if (
            $actor->can('hr.admin')
            || $actor->can('hr.edit')
            || $actor->can('leave.admin')
            || $actor->can('leave.balance.import')
            || $actor->hasAnyRole(['HR Manager', 'HR Administrator', 'System Admin'])
        ) {
            return;
        }

        abort(403, 'Access restricted to HR administrators.');
    }

    /** @return list<array<string, string>> */
    private function parseCsv(UploadedFile $file): array
    {
        $handle = fopen($file->getRealPath() ?: '', 'r');
        if (! is_resource($handle)) {
            throw ValidationException::withMessages(['file' => 'The CSV file could not be read.']);
        }

        $header = fgetcsv($handle);
        if (! $header) {
            fclose($handle);
            throw ValidationException::withMessages(['file' => 'The CSV file is empty.']);
        }

        if (isset($header[0])) {
            $header[0] = preg_replace('/^\xEF\xBB\xBF/', '', (string) $header[0]);
        }

        $map = [];
        foreach ($header as $i => $label) {
            $key = strtolower(trim((string) $label));
            $key = str_replace([' ', '-'], '_', $key);
            $aliases = [
                'staff_email' => 'email',
                'e_mail' => 'email',
                'type' => 'leave_type',
                'from' => 'start_date',
                'to' => 'end_date',
                'kind' => 'record_type',
                'opening_days' => 'annual_days',
                'days' => 'annual_days',
                'period_year' => 'year',
            ];
            $map[$i] = $aliases[$key] ?? $key;
        }

        $rows = [];
        while (($data = fgetcsv($handle)) !== false) {
            if (count($rows) >= self::MAX_ROWS) {
                fclose($handle);
                throw ValidationException::withMessages(['file' => 'Import at most '.self::MAX_ROWS.' rows at a time.']);
            }
            if ($this->rowIsEmpty($data)) {
                continue;
            }
            $assoc = [];
            foreach ($data as $i => $value) {
                $assoc[$map[$i] ?? "col_{$i}"] = trim((string) $value);
            }
            $rows[] = $assoc;
        }
        fclose($handle);

        if ($rows === []) {
            throw ValidationException::withMessages(['file' => 'The CSV file has no data rows.']);
        }

        return $rows;
    }

    /** @param list<string|null> $data */
    private function rowIsEmpty(array $data): bool
    {
        foreach ($data as $value) {
            if (trim((string) $value) !== '') {
                return false;
            }
        }

        return true;
    }

    /**
     * @param  array<string, string>  $raw
     * @param  \Illuminate\Support\Collection<string, User>  $users
     * @return array<string, mixed>
     */
    private function normaliseRow(array $raw, $users, int $policyId, User $actor, int $rowNumber): array
    {
        $email = strtolower($raw['email'] ?? '');
        if ($email === '' || ! filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw ValidationException::withMessages(['email' => "Row {$rowNumber}: a valid staff email is required."]);
        }

        $requester = $users->get($email);
        if (! $requester) {
            throw ValidationException::withMessages(['email' => "Row {$rowNumber}: no staff member matches {$email}."]);
        }

        $kind = strtolower($raw['record_type'] ?? 'leave');
        if (! in_array($kind, ['leave', 'balance'], true)) {
            throw ValidationException::withMessages(['record_type' => "Row {$rowNumber}: record_type must be leave or balance."]);
        }

        if ($kind === 'balance') {
            $year = (int) ($raw['year'] ?: date('Y'));
            $days = (int) ($raw['annual_days'] ?: $raw['days'] ?? 0);
            if ($year < 2000 || $year > 2099) {
                throw ValidationException::withMessages(['year' => "Row {$rowNumber}: year is invalid."]);
            }
            if ($days < 0 || $days > 365) {
                throw ValidationException::withMessages(['annual_days' => "Row {$rowNumber}: annual_days must be between 0 and 365."]);
            }

            return [
                'kind' => 'balance',
                'requester' => $requester,
                'year' => $year,
                'annual_days' => $days,
                'lil_hours' => (float) ($raw['lil_hours'] ?: 0),
                'preview' => [
                    'row' => $rowNumber,
                    'record_type' => 'balance',
                    'email' => $requester->email,
                    'name' => $requester->name,
                    'year' => $year,
                    'annual_days' => $days,
                    'lil_hours' => (float) ($raw['lil_hours'] ?: 0),
                ],
            ];
        }

        $leaveType = strtolower($raw['leave_type'] ?? '');
        $leaveTypeAliases = [
            'toil' => 'lil',
            'time_off_in_lieu' => 'lil',
            'annual_leave' => 'annual',
            'sick_leave' => 'sick',
        ];
        $leaveType = $leaveTypeAliases[$leaveType] ?? $leaveType;
        $allowed = ['annual', 'sick', 'lil', 'special', 'maternity', 'paternity', 'compassionate', 'study', 'unpaid', 'home'];
        if (! in_array($leaveType, $allowed, true)) {
            throw ValidationException::withMessages(['leave_type' => "Row {$rowNumber}: unsupported leave type."]);
        }

        $start = $raw['start_date'] ?? '';
        $end = $raw['end_date'] ?? '';
        if (! preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || ! preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
            throw ValidationException::withMessages(['start_date' => "Row {$rowNumber}: start_date and end_date must be YYYY-MM-DD."]);
        }
        if ($end < $start) {
            throw ValidationException::withMessages(['end_date' => "Row {$rowNumber}: end_date must be on or after start_date."]);
        }

        $status = strtolower($raw['status'] ?: 'approved');
        if (! in_array($status, ['draft', 'approved'], true)) {
            throw ValidationException::withMessages(['status' => "Row {$rowNumber}: status must be draft or approved."]);
        }

        $type = $this->policyService->leaveType($actor->tenant_id, $leaveType);
        if (! $type) {
            throw ValidationException::withMessages(['leave_type' => "Row {$rowNumber}: leave type is not in the active policy."]);
        }

        $calc = $this->calendarService->calculate($requester, $start, $end);
        $daysRequested = (int) round($calc['working_days']);
        if ($daysRequested < 1) {
            throw ValidationException::withMessages(['start_date' => "Row {$rowNumber}: leave range has no working days."]);
        }

        $reason = trim((string) ($raw['reason'] ?? ''));

        return [
            'kind' => 'leave',
            'requester' => $requester,
            'leave_type' => $leaveType,
            'leave_type_id' => $type->id,
            'start_date' => $start,
            'end_date' => $end,
            'days_requested' => $daysRequested,
            'reason' => $reason !== '' ? $reason : 'Imported historical leave',
            'status' => $status,
            'calendar' => $calc,
            'preview' => [
                'row' => $rowNumber,
                'record_type' => 'leave',
                'email' => $requester->email,
                'name' => $requester->name,
                'leave_type' => $leaveType,
                'start_date' => $start,
                'end_date' => $end,
                'days_requested' => $daysRequested,
                'status' => $status,
            ],
        ];
    }

    private function leaveExists(User $requester, string $leaveType, string $start, string $end): bool
    {
        return LeaveRequest::query()
            ->where('tenant_id', $requester->tenant_id)
            ->where('requester_id', $requester->id)
            ->where('leave_type', $leaveType)
            ->whereDate('start_date', $start)
            ->whereDate('end_date', $end)
            ->exists();
    }

    /** @param array<string, mixed> $row */
    private function storeLeave(array $row, User $actor, int $policyId): void
    {
        $requester = $row['requester'];
        $calc = $row['calendar'];
        $leave = LeaveRequest::create([
            'tenant_id' => $requester->tenant_id,
            'requester_id' => $requester->id,
            'policy_version_id' => $policyId,
            'reference_number' => 'LVE-'.strtoupper(Str::random(8)),
            'leave_type' => $row['leave_type'],
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'days_requested' => $row['days_requested'],
            'reason' => $row['reason'],
            'status' => $row['status'],
            'current_stage' => $row['status'] === 'approved' ? 'Approved' : 'Draft',
            'current_holder' => $row['status'] === 'approved' ? null : $requester->name,
            'approved_by' => $row['status'] === 'approved' ? $actor->id : null,
            'approved_at' => $row['status'] === 'approved' ? now() : null,
            'submitted_at' => $row['status'] === 'approved' ? now() : null,
            'recommendation_status' => $row['status'] === 'approved' ? 'recommended' : null,
            'certification_status' => $row['status'] === 'approved' ? 'certified' : null,
            'prepared_by' => $actor->id,
        ]);

        $segment = $leave->segments()->create([
            'leave_type_id' => $row['leave_type_id'],
            'leave_type' => $row['leave_type'],
            'start_date' => $row['start_date'],
            'end_date' => $row['end_date'],
            'day_part' => 'full',
            'calendar_days' => $calc['calendar_days'],
            'weekend_days' => $calc['weekend_days'],
            'public_holidays_excluded' => $calc['public_holidays_excluded'],
            'working_days' => $calc['working_days'],
            'amount_requested' => $row['days_requested'],
        ]);

        if ($row['status'] === 'approved' && $row['leave_type'] !== 'lil') {
            $leave->setRelation('segments', collect([$segment]));
            $this->balanceService->postLeaveTaken($leave, $actor);
        }
    }

    /** @param array<string, mixed> $row */
    private function applyBalance(array $row, User $actor, int $policyId): void
    {
        $requester = $row['requester'];
        LeaveBalance::updateOrCreate(
            [
                'user_id' => $requester->id,
                'period_year' => $row['year'],
            ],
            [
                'annual_balance_days' => $row['annual_days'],
                'lil_hours_available' => $row['lil_hours'],
            ]
        );

        $exists = LeaveLedgerEntry::query()
            ->where('tenant_id', $requester->tenant_id)
            ->where('user_id', $requester->id)
            ->where('leave_type', 'annual')
            ->where('transaction_type', LeaveLedgerEntry::OPENING_BALANCE)
            ->whereYear('effective_date', $row['year'])
            ->exists();

        if ($exists) {
            return;
        }

        LeaveLedgerEntry::create([
            'tenant_id' => $requester->tenant_id,
            'user_id' => $requester->id,
            'policy_version_id' => $policyId,
            'leave_type' => 'annual',
            'transaction_type' => LeaveLedgerEntry::OPENING_BALANCE,
            'amount' => $row['annual_days'],
            'unit' => 'days',
            'effective_date' => sprintf('%d-01-01', $row['year']),
            'reference' => 'OPEN-'.$row['year'],
            'balance_after' => $row['annual_days'],
            'recorded_by' => $actor->id,
            'reason' => 'Opening balance imported for go-live',
        ]);
    }
}
