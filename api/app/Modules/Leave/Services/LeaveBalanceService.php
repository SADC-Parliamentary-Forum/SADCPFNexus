<?php

namespace App\Modules\Leave\Services;

use App\Models\LeaveBalance;
use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\LeaveSegment;
use App\Models\ToilCredit;
use App\Models\User;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;

class LeaveBalanceService
{
    /** @return array<string, mixed> */
    public function balanceFor(User $employee, string $leaveType, ?CarbonInterface $asOf = null, ?int $ignoreLeaveRequestId = null): array
    {
        $asOf ??= now();

        $ledgerTotal = (float) LeaveLedgerEntry::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('user_id', $employee->id)
            ->where('leave_type', $leaveType)
            ->whereDate('effective_date', '<=', $asOf->toDateString())
            ->sum('amount');

        $hasLedger = LeaveLedgerEntry::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('user_id', $employee->id)
            ->where('leave_type', $leaveType)
            ->exists();

        if (! $hasLedger && $leaveType === 'annual') {
            $legacy = LeaveBalance::query()
                ->where('user_id', $employee->id)
                ->where('period_year', (int) $asOf->format('Y'))
                ->first();
            $ledgerTotal = (float) ($legacy?->annual_balance_days ?? 0);
        }

        if ($leaveType === 'lil') {
            $toilDays = (float) ToilCredit::query()
                ->where('tenant_id', $employee->tenant_id)
                ->where('user_id', $employee->id)
                ->whereIn('status', [ToilCredit::AVAILABLE, ToilCredit::PARTIALLY_USED, ToilCredit::EXTENDED])
                ->whereDate('expiry_date', '>=', now()->toDateString())
                ->sum('remaining_balance');
            $ledgerTotal = max($ledgerTotal, $toilDays);
        }

        $pending = (float) LeaveSegment::query()
            ->whereHas('leaveRequest', function ($q) use ($employee, $ignoreLeaveRequestId) {
                $q->where('tenant_id', $employee->tenant_id)
                    ->where('requester_id', $employee->id)
                    ->whereIn('status', ['submitted', 'resubmitted', 'pending_next_step']);

                if ($ignoreLeaveRequestId) {
                    $q->where('id', '!=', $ignoreLeaveRequestId);
                }
            })
            ->where('leave_type', $leaveType)
            ->sum('amount_requested');

        $approvedFuture = (float) LeaveRequest::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('requester_id', $employee->id)
            ->where('leave_type', $leaveType)
            ->where('status', 'approved')
            ->whereDate('start_date', '>', now()->toDateString())
            ->sum('days_requested');

        return [
            'leave_type' => $leaveType,
            'balance' => round($ledgerTotal, 2),
            'pending' => round($pending, 2),
            'approved_future' => round($approvedFuture, 2),
            'available' => round($ledgerTotal - $pending, 2),
            'source' => $hasLedger ? 'ledger' : ($leaveType === 'annual' ? 'legacy_balance' : 'ledger'),
        ];
    }

    public function assertAvailable(User $employee, string $leaveType, float $amount, ?int $ignoreLeaveRequestId = null): void
    {
        $balance = $this->balanceFor($employee, $leaveType, now(), $ignoreLeaveRequestId);
        if ($amount > (float) $balance['available']) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'balance' => "You have {$balance['available']} {$leaveType} leave days available, but this request requires {$amount} working days.",
            ]);
        }
    }

    public function postLeaveTaken(LeaveRequest $leave, User $approver): void
    {
        $leave->loadMissing(['requester', 'segments']);

        DB::transaction(function () use ($leave, $approver) {
            foreach ($leave->segments as $segment) {
                $exists = LeaveLedgerEntry::query()
                    ->where('source_type', LeaveSegment::class)
                    ->where('source_id', $segment->id)
                    ->where('transaction_type', LeaveLedgerEntry::LEAVE_TAKEN)
                    ->exists();

                if ($exists || (float) $segment->amount_requested <= 0) {
                    continue;
                }

                if ($segment->leave_type === 'lil') {
                    app(LeaveToilCreditService::class)->consumeForSegment($leave, $segment, $approver);

                    continue;
                }

                $amount = -1 * (float) $segment->amount_requested;
                $lockedRows = LeaveLedgerEntry::query()
                    ->where('tenant_id', $leave->tenant_id)
                    ->where('user_id', $leave->requester_id)
                    ->where('leave_type', $segment->leave_type)
                    ->lockForUpdate()
                    ->get(['amount']);
                $running = (float) $lockedRows->sum('amount');

                LeaveLedgerEntry::create([
                    'tenant_id' => $leave->tenant_id,
                    'user_id' => $leave->requester_id,
                    'leave_type_id' => $segment->leave_type_id,
                    'policy_version_id' => $leave->policy_version_id,
                    'leave_type' => $segment->leave_type,
                    'transaction_type' => LeaveLedgerEntry::LEAVE_TAKEN,
                    'amount' => $amount,
                    'unit' => 'days',
                    'effective_date' => $segment->start_date,
                    'source_type' => LeaveSegment::class,
                    'source_id' => $segment->id,
                    'reference' => $leave->reference_number,
                    'balance_after' => round($running + $amount, 2),
                    'recorded_by' => $approver->id,
                    'approved_by' => $approver->id,
                    'reason' => 'Approved leave application',
                ]);
            }
        });
    }
}
