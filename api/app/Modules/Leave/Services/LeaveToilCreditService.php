<?php

namespace App\Modules\Leave\Services;

use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\LeaveSegment;
use App\Models\Notification;
use App\Models\OvertimeAccrual;
use App\Models\ToilCredit;
use App\Models\ToilExtension;
use App\Models\TravelToilCandidate;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class LeaveToilCreditService
{
    public function __construct(private readonly NotificationService $notificationService)
    {
    }

    public function ensureCreditFromTravelCandidate(TravelToilCandidate $candidate): ToilCredit
    {
        if ($candidate->status !== TravelToilCandidate::STATUS_CREDITED) {
            throw ValidationException::withMessages([
                'toil' => ['TOIL can only be used after HR validation and crediting.'],
            ]);
        }

        $expiry = $candidate->expires_at ?? $candidate->credited_at?->copy()->addDays(30) ?? now()->addDays(30);

        $credit = ToilCredit::firstOrCreate(
            ['source_type' => TravelToilCandidate::class, 'source_id' => $candidate->id],
            [
                'tenant_id' => $candidate->tenant_id,
                'user_id' => $candidate->user_id,
                'credit_reference' => 'TOIL-' . strtoupper(Str::random(8)),
                'duty_date' => $candidate->candidate_date,
                'earned_amount' => (float) $candidate->hours,
                'unit' => 'hours',
                'credited_days' => round(((float) $candidate->hours) / 8, 2),
                'accrual_date' => $candidate->credited_at?->toDateString() ?? now()->toDateString(),
                'expiry_date' => $expiry->toDateString(),
                'original_balance' => round(((float) $candidate->hours) / 8, 2),
                'remaining_balance' => round(((float) $candidate->hours) / 8, 2),
                'status' => ToilCredit::AVAILABLE,
                'validated_by' => $candidate->hr_validated_by,
                'validated_at' => $candidate->hr_validated_at,
            ]
        );

        LeaveLedgerEntry::firstOrCreate(
            ['source_type' => ToilCredit::class, 'source_id' => $credit->id, 'transaction_type' => LeaveLedgerEntry::TOIL_CREDIT],
            [
                'tenant_id' => $credit->tenant_id,
                'user_id' => $credit->user_id,
                'leave_type' => 'lil',
                'amount' => $credit->credited_days,
                'unit' => 'days',
                'effective_date' => $credit->accrual_date,
                'reference' => $credit->credit_reference,
                'balance_after' => null,
                'recorded_by' => $credit->validated_by,
                'approved_by' => $credit->validated_by,
                'reason' => 'Validated travel TOIL credit',
            ]
        );

        return $credit;
    }

    /**
     * Bridge timesheet/travel OvertimeAccrual into Leave Phase 1 ToilCredit.
     * Idempotent by source_type + source_id — never double-credits.
     */
    public function ensureCreditFromOvertimeAccrual(OvertimeAccrual $accrual, ?User $actor = null): ToilCredit
    {
        $user = $accrual->relationLoaded('user') ? $accrual->user : $accrual->user()->first();
        if (! $user) {
            throw ValidationException::withMessages(['toil' => ['Overtime accrual has no owning user.']]);
        }

        $hours = (float) $accrual->hours;
        $days = round($hours / 8, 2);
        $expiry = $accrual->expires_at
            ? Carbon::parse($accrual->expires_at)->toDateString()
            : Carbon::parse($accrual->accrual_date ?? now())->addDays(30)->toDateString();

        $credit = ToilCredit::firstOrCreate(
            ['source_type' => OvertimeAccrual::class, 'source_id' => $accrual->id],
            [
                'tenant_id' => $user->tenant_id,
                'user_id' => $user->id,
                'credit_reference' => 'TOIL-OT-'.strtoupper(Str::random(8)),
                'duty_date' => $accrual->accrual_date,
                'earned_amount' => $hours,
                'unit' => 'hours',
                'credited_days' => $days,
                'accrual_date' => $accrual->accrual_date?->toDateString() ?? now()->toDateString(),
                'expiry_date' => $expiry,
                'original_balance' => $days,
                'remaining_balance' => $days,
                'status' => ToilCredit::AVAILABLE,
                'validated_by' => $actor?->id,
                'validated_at' => now(),
            ]
        );

        LeaveLedgerEntry::firstOrCreate(
            ['source_type' => ToilCredit::class, 'source_id' => $credit->id, 'transaction_type' => LeaveLedgerEntry::TOIL_CREDIT],
            [
                'tenant_id' => $credit->tenant_id,
                'user_id' => $credit->user_id,
                'leave_type' => 'lil',
                'amount' => $credit->credited_days,
                'unit' => 'days',
                'effective_date' => $credit->accrual_date,
                'reference' => $credit->credit_reference,
                'balance_after' => null,
                'recorded_by' => $credit->validated_by,
                'approved_by' => $credit->validated_by,
                'reason' => $accrual->description ?: ('Timesheet OT TOIL credit '.$accrual->code),
            ]
        );

        if (! $accrual->is_linked) {
            $accrual->update(['is_linked' => true]);
        }

        return $credit;
    }

    public function assertCreditUsable(ToilCredit $credit, float $requestedDays): void
    {
        if ($credit->expiry_date->lt(now()->startOfDay())) {
            throw ValidationException::withMessages([
                'toil' => ["This leave-in-lieu entitlement expired on {$credit->expiry_date->toDateString()}. An approved Secretary General extension is required before it can be used."],
            ]);
        }

        if (! in_array($credit->status, [ToilCredit::AVAILABLE, ToilCredit::PARTIALLY_USED, ToilCredit::EXTENDED], true)) {
            throw ValidationException::withMessages(['toil' => ['This TOIL credit is not available for use.']]);
        }

        if ((float) $credit->remaining_balance < $requestedDays) {
            throw ValidationException::withMessages([
                'toil' => ["This TOIL credit has {$credit->remaining_balance} days remaining, but {$requestedDays} days are requested."],
            ]);
        }
    }

    public function consumeForSegment(LeaveRequest $leave, LeaveSegment $segment, User $actor): void
    {
        if ((float) $segment->amount_requested <= 0) {
            return;
        }

        DB::transaction(function () use ($leave, $segment, $actor) {
            $alreadyConsumed = LeaveLedgerEntry::query()
                ->where('source_type', LeaveSegment::class)
                ->where('source_id', $segment->id)
                ->where('transaction_type', LeaveLedgerEntry::TOIL_USAGE)
                ->exists();

            if ($alreadyConsumed) {
                return;
            }

            $remainingToConsume = (float) $segment->amount_requested;
            $credits = $this->creditsForConsumption($leave, $segment)->get();

            foreach ($credits as $credit) {
                if ($remainingToConsume <= 0) {
                    break;
                }

                $this->assertCreditUsable($credit, min($remainingToConsume, (float) $credit->remaining_balance));

                $amount = min($remainingToConsume, (float) $credit->remaining_balance);
                $used = round((float) $credit->used_balance + $amount, 2);
                $remaining = round((float) $credit->remaining_balance - $amount, 2);

                $runningBalance = (float) LeaveLedgerEntry::query()
                    ->where('tenant_id', $leave->tenant_id)
                    ->where('user_id', $leave->requester_id)
                    ->where('leave_type', 'lil')
                    ->lockForUpdate()
                    ->get(['amount'])
                    ->sum('amount');

                $credit->update([
                    'used_balance' => $used,
                    'remaining_balance' => $remaining,
                    'status' => $remaining <= 0 ? ToilCredit::USED : ToilCredit::PARTIALLY_USED,
                ]);

                LeaveLedgerEntry::create([
                    'tenant_id' => $leave->tenant_id,
                    'user_id' => $leave->requester_id,
                    'leave_type_id' => $segment->leave_type_id,
                    'policy_version_id' => $leave->policy_version_id,
                    'leave_type' => 'lil',
                    'transaction_type' => LeaveLedgerEntry::TOIL_USAGE,
                    'amount' => -1 * $amount,
                    'unit' => 'days',
                    'effective_date' => $segment->start_date,
                    'source_type' => LeaveSegment::class,
                    'source_id' => $segment->id,
                    'reference' => $leave->reference_number . ':' . $credit->credit_reference,
                    'balance_after' => round($runningBalance - $amount, 2),
                    'recorded_by' => $actor->id,
                    'approved_by' => $actor->id,
                    'reason' => 'Approved leave-in-lieu usage',
                ]);

                $remainingToConsume = round($remainingToConsume - $amount, 2);
            }

            if ($remainingToConsume > 0) {
                throw ValidationException::withMessages([
                    'toil' => "Available TOIL credits are short by {$remainingToConsume} days.",
                ]);
            }
        });
    }

    /** @return array{expired:int, alerts_sent:int} */
    public function manageExpiryAndAlerts(?int $tenantId = null, array $thresholds = [14, 7, 3, 0]): array
    {
        $today = Carbon::today();
        $expired = 0;
        $alerts = 0;

        ToilCredit::query()
            ->with('user')
            ->whereIn('status', [ToilCredit::AVAILABLE, ToilCredit::PARTIALLY_USED, ToilCredit::EXTENDED])
            ->where('remaining_balance', '>', 0)
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereDate('expiry_date', '<', $today->toDateString())
            ->orderBy('expiry_date')
            ->limit(500)
            ->get()
            ->each(function (ToilCredit $credit) use (&$expired) {
                $this->expireCredit($credit);
                $expired++;
            });

        $maxThreshold = max($thresholds);
        ToilCredit::query()
            ->with('user')
            ->whereIn('status', [ToilCredit::AVAILABLE, ToilCredit::PARTIALLY_USED, ToilCredit::EXTENDED])
            ->where('remaining_balance', '>', 0)
            ->when($tenantId, fn ($query) => $query->where('tenant_id', $tenantId))
            ->whereBetween('expiry_date', [$today->toDateString(), $today->copy()->addDays($maxThreshold)->toDateString()])
            ->orderBy('expiry_date')
            ->get()
            ->each(function (ToilCredit $credit) use (&$alerts, $today, $thresholds) {
                $days = (int) $today->diffInDays($credit->expiry_date, false);

                if (! in_array($days, $thresholds, true) || ! $credit->user) {
                    return;
                }

                $subjectNeedle = "{$credit->credit_reference} expires";
                $alreadySent = Notification::query()
                    ->where('user_id', $credit->user_id)
                    ->where('trigger', 'leave.toil_expiry_alert')
                    ->whereDate('created_at', $today->toDateString())
                    ->where('subject', 'like', '%' . $subjectNeedle . '%')
                    ->exists();

                if ($alreadySent) {
                    return;
                }

                $this->notificationService->dispatch($credit->user, 'leave.toil_expiry_alert', [
                    'name' => $credit->user->name,
                    'reference' => $credit->credit_reference,
                    'days' => (string) $days,
                    'expiry_date' => $credit->expiry_date->toDateString(),
                    'remaining' => (string) $credit->remaining_balance,
                ], [
                    'module' => 'leave',
                    'record_id' => $credit->id,
                    'url' => '/leave/toil',
                ], false, false);

                $alerts++;
            });

        return ['expired' => $expired, 'alerts_sent' => $alerts];
    }

    public function requestOrApproveExtension(ToilCredit $credit, User $actor, string $requestedExpiryDate, string $reason, ?string $comments = null): ToilExtension
    {
        if (trim($reason) === '') {
            throw ValidationException::withMessages(['reason' => 'A reason is required for a TOIL extension.']);
        }

        return DB::transaction(function () use ($credit, $actor, $requestedExpiryDate, $reason, $comments) {
            $isFinalApprover = $actor->hasRole('Secretary General') || $actor->isSystemAdmin();
            $extension = ToilExtension::create([
                'toil_credit_id' => $credit->id,
                'original_expiry_date' => $credit->expiry_date,
                'requested_expiry_date' => $requestedExpiryDate,
                'reason' => $reason,
                'status' => $isFinalApprover ? 'approved' : 'pending',
                'approved_expiry_date' => $isFinalApprover ? $requestedExpiryDate : null,
                'decided_by' => $isFinalApprover ? $actor->id : null,
                'decided_at' => $isFinalApprover ? now() : null,
                'comments' => $comments,
            ]);

            if ($isFinalApprover) {
                $wasExpired = $credit->status === ToilCredit::EXPIRED;

                $credit->update([
                    'expiry_date' => $requestedExpiryDate,
                    'status' => (float) $credit->remaining_balance > 0 ? ToilCredit::EXTENDED : $credit->status,
                ]);

                if ($wasExpired && (float) $credit->remaining_balance > 0) {
                    $this->postExpiryReversal($credit, $actor, $extension);
                }

                $credit->loadMissing('user');
                if ($credit->user) {
                    $this->notificationService->dispatch($credit->user, 'leave.toil_extended', [
                        'name' => $credit->user->name,
                        'reference' => $credit->credit_reference,
                        'expiry_date' => $requestedExpiryDate,
                    ], [
                        'module' => 'leave',
                        'record_id' => $credit->id,
                        'url' => '/leave/toil',
                    ], false, false);
                }
            }

            return $extension->fresh('credit');
        });
    }

    private function creditsForConsumption(LeaveRequest $leave, LeaveSegment $segment): \Illuminate\Database\Eloquent\Builder
    {
        $query = ToilCredit::query()
            ->where('tenant_id', $leave->tenant_id)
            ->where('user_id', $leave->requester_id)
            ->whereIn('status', [ToilCredit::AVAILABLE, ToilCredit::PARTIALLY_USED, ToilCredit::EXTENDED])
            ->where('remaining_balance', '>', 0)
            ->whereDate('expiry_date', '>=', now()->toDateString())
            ->lockForUpdate();

        if ($segment->source_type === ToilCredit::class && $segment->source_id) {
            $query->whereKey($segment->source_id);
        }

        return $query->orderBy('expiry_date')->orderBy('accrual_date')->orderBy('id');
    }

    private function expireCredit(ToilCredit $credit): void
    {
        DB::transaction(function () use ($credit) {
            $credit = ToilCredit::query()->whereKey($credit->id)->lockForUpdate()->firstOrFail();

            if (! in_array($credit->status, [ToilCredit::AVAILABLE, ToilCredit::PARTIALLY_USED, ToilCredit::EXTENDED], true)) {
                return;
            }

            $amount = (float) $credit->remaining_balance;
            $exists = LeaveLedgerEntry::query()
                ->where('source_type', ToilCredit::class)
                ->where('source_id', $credit->id)
                ->where('transaction_type', LeaveLedgerEntry::TOIL_EXPIRY)
                ->exists();

            if (! $exists && $amount > 0) {
                $runningBalance = (float) LeaveLedgerEntry::query()
                    ->where('tenant_id', $credit->tenant_id)
                    ->where('user_id', $credit->user_id)
                    ->where('leave_type', 'lil')
                    ->lockForUpdate()
                    ->get(['amount'])
                    ->sum('amount');

                LeaveLedgerEntry::create([
                    'tenant_id' => $credit->tenant_id,
                    'user_id' => $credit->user_id,
                    'leave_type' => 'lil',
                    'transaction_type' => LeaveLedgerEntry::TOIL_EXPIRY,
                    'amount' => -1 * $amount,
                    'unit' => 'days',
                    'effective_date' => now()->toDateString(),
                    'source_type' => ToilCredit::class,
                    'source_id' => $credit->id,
                    'reference' => $credit->credit_reference,
                    'balance_after' => round($runningBalance - $amount, 2),
                    'reason' => 'TOIL credit expired',
                ]);
            }

            $credit->update(['status' => ToilCredit::EXPIRED]);
        });
    }

    private function postExpiryReversal(ToilCredit $credit, User $actor, ToilExtension $extension): void
    {
        $exists = LeaveLedgerEntry::query()
            ->where('source_type', ToilExtension::class)
            ->where('source_id', $extension->id)
            ->where('transaction_type', LeaveLedgerEntry::ADJUSTMENT)
            ->exists();

        if ($exists) {
            return;
        }

        $amount = (float) $credit->remaining_balance;
        $runningBalance = (float) LeaveLedgerEntry::query()
            ->where('tenant_id', $credit->tenant_id)
            ->where('user_id', $credit->user_id)
            ->where('leave_type', 'lil')
            ->lockForUpdate()
            ->get(['amount'])
            ->sum('amount');

        LeaveLedgerEntry::create([
            'tenant_id' => $credit->tenant_id,
            'user_id' => $credit->user_id,
            'leave_type' => 'lil',
            'transaction_type' => LeaveLedgerEntry::ADJUSTMENT,
            'amount' => $amount,
            'unit' => 'days',
            'effective_date' => now()->toDateString(),
            'source_type' => ToilExtension::class,
            'source_id' => $extension->id,
            'reference' => $credit->credit_reference,
            'balance_after' => round($runningBalance + $amount, 2),
            'recorded_by' => $actor->id,
            'approved_by' => $actor->id,
            'reason' => 'Secretary General TOIL extension restored expired credit',
        ]);
    }
}
