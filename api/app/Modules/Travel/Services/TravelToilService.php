<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\CalendarEntry;
use App\Models\Department;
use App\Models\OvertimeAccrual;
use App\Models\TenantSetting;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TravelToilService
{
    public function __construct(
        protected NotificationService $notificationService,
    ) {}

    /**
     * Auto-generate TOIL candidates for weekend/holiday days during official duty.
     * Never creates LeaveRequest or OvertimeAccrual — human approval required first.
     *
     * @return list<TravelToilCandidate>
     */
    public function generateForTravel(TravelRequest $travel): array
    {
        if (! config('travel.auto_generate_candidates', true)) {
            return [];
        }

        if (! $travel->isApproved() && ! $travel->returned_at) {
            return [];
        }

        $user = $travel->requester;
        if (! $user) {
            return [];
        }

        // Hard lock: never auto-create leave
        if (config('travel.auto_create_leave_from_travel')) {
            throw new \RuntimeException('auto_create_leave_from_travel must remain false');
        }

        $minDate = Carbon::parse($travel->actual_departure_date ?? $travel->departure_date);
        $maxDate = Carbon::parse($travel->actual_return_date ?? $travel->return_date);

        $naHolidayDates = CalendarEntry::where('tenant_id', $travel->tenant_id)
            ->where('type', CalendarEntry::TYPE_SADC_HOLIDAY)
            ->where('country_code', 'NA')
            ->where('date', '>=', $minDate)
            ->where('date', '<=', $maxDate)
            ->pluck('date')
            ->map(fn ($d) => $d->format('Y-m-d'))
            ->flip()
            ->all();

        $hours = (float) config('travel.toil_hours_per_day', 8.0);
        $createdOrFound = [];
        $newlyCreated = 0;

        for ($d = $minDate->copy(); $d->lte($maxDate); $d->addDay()) {
            $dateStr = $d->format('Y-m-d');
            $isWeekend = $d->isWeekend();
            $isHoliday = isset($naHolidayDates[$dateStr]);
            if (! $isWeekend && ! $isHoliday) {
                continue;
            }

            $reason = $isWeekend && $isHoliday ? 'both' : ($isWeekend ? 'weekend' : 'public_holiday');

            $candidate = TravelToilCandidate::firstOrCreate(
                [
                    'travel_request_id' => $travel->id,
                    'candidate_date'    => $dateStr,
                ],
                [
                    'tenant_id' => $travel->tenant_id,
                    'user_id'   => $travel->requester_id,
                    'hours'     => $hours,
                    'reason'    => $reason,
                    'status'    => TravelToilCandidate::STATUS_AWAITING_EMPLOYEE_CONFIRMATION,
                ]
            );

            if ($candidate->wasRecentlyCreated) {
                $newlyCreated++;
            }

            $createdOrFound[] = $candidate;
        }

        AuditLog::record('travel.toil_candidates_generated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => [
                'count' => count($createdOrFound),
                'newly_created' => $newlyCreated,
                'leave_credited' => false,
            ],
            'tags'           => 'travel,toil',
        ]);

        if ($newlyCreated > 0) {
            $this->notifyEmployeeConfirmationRequired($travel, $user, $newlyCreated);
        }

        return $createdOrFound;
    }

    /**
     * A travel amendment changed departure/return dates after TOIL candidates were
     * already generated. Non-credited candidates outside the new range are safe to
     * discard (nothing has been paid out yet); generation is re-run to pick up any
     * newly in-range dates. Already-credited candidates are never silently rewritten —
     * they're flagged for HR review instead, per the "HR review required, not silent
     * rewrite" rule.
     */
    public function reconcileForAmendment(TravelRequest $travel): void
    {
        if (! $travel->returned_at) {
            // Mission hasn't closed yet; no candidates could exist from generateForTravel's
            // markReturned trigger, so there's nothing to reconcile.
            return;
        }

        $minDate = Carbon::parse($travel->actual_departure_date ?? $travel->departure_date)->toDateString();
        $maxDate = Carbon::parse($travel->actual_return_date ?? $travel->return_date)->toDateString();

        $candidates = TravelToilCandidate::where('travel_request_id', $travel->id)->get();

        $outOfRange = fn (TravelToilCandidate $c) => $c->candidate_date->toDateString() < $minDate
            || $c->candidate_date->toDateString() > $maxDate;

        foreach ($candidates as $candidate) {
            if (in_array($candidate->status, [
                TravelToilCandidate::STATUS_CREDITED,
                TravelToilCandidate::STATUS_EXTENDED,
            ], true)) {
                $candidate->update([
                    'status' => TravelToilCandidate::STATUS_AMENDMENT_REVIEW,
                    'amendment_review_reason' => 'Travel dates amended after this TOIL day was already credited (was '
                        . $candidate->candidate_date->toDateString() . '). Original credit left untouched — review required.',
                ]);
                continue;
            }

            if (in_array($candidate->status, TravelToilCandidate::TERMINAL_STATUSES, true)) {
                continue; // rejected/expired — leave as-is, nothing to reconcile.
            }

            if ($outOfRange($candidate)) {
                $candidate->delete();
            }
        }

        $this->notifyAmendmentReview($travel, $candidates);

        $this->generateForTravel($travel);
    }

    private function notifyAmendmentReview(TravelRequest $travel, \Illuminate\Support\Collection $candidates): void
    {
        $flagged = $candidates->filter(fn ($c) => $c->status === TravelToilCandidate::STATUS_AMENDMENT_REVIEW);
        if ($flagged->isEmpty()) {
            return;
        }

        $hrUsers = User::role(['HR Manager', 'HR Administrator'])
            ->where('tenant_id', $travel->tenant_id)
            ->where('is_active', true)
            ->get();

        if ($hrUsers->isEmpty()) {
            return;
        }

        $this->notificationService->dispatchToMany($hrUsers, 'travel.toil_amendment_review_required', [
            'reference' => $travel->reference_number,
            'count' => (string) $flagged->count(),
        ], [
            'module' => 'travel',
            'record_id' => $travel->id,
            'url' => '/travel/toil',
        ]);
    }

    public function generateCatchUp(): int
    {
        if (! config('travel.auto_generate_candidates', true)) {
            return 0;
        }

        $travels = TravelRequest::where('status', 'approved')
            ->where(function ($q) {
                $q->whereNotNull('returned_at')
                    ->orWhere('return_date', '<', now()->toDateString());
            })
            ->whereDoesntHave('toilCandidates')
            ->limit(200)
            ->get();

        $n = 0;
        foreach ($travels as $travel) {
            $n += count($this->generateForTravel($travel));
        }

        return $n;
    }

    /**
     * Mark credited/extended TOIL past expiry as expired (no leave balance use after expiry).
     */
    public function expireOverdue(): int
    {
        $candidates = TravelToilCandidate::query()
            ->whereIn('status', [
                TravelToilCandidate::STATUS_CREDITED,
                TravelToilCandidate::STATUS_EXTENDED,
            ])
            ->whereNotNull('expires_at')
            ->whereDate('expires_at', '<', now()->toDateString())
            ->limit(500)
            ->get();

        $n = 0;
        foreach ($candidates as $candidate) {
            $candidate->update(['status' => TravelToilCandidate::STATUS_EXPIRED]);
            $n++;
        }

        return $n;
    }

    /**
     * Optional OT stamp (legacy endpoint). Does not credit leave.
     * Moves candidate into supervisor-pending with OT authorised metadata.
     */
    public function authoriseOt(TravelToilCandidate $candidate, User $user): TravelToilCandidate
    {
        $this->assertStatus($candidate, [
            TravelToilCandidate::STATUS_PENDING_SUPERVISOR,
            TravelToilCandidate::STATUS_OT_AUTHORISED,
            'candidate',
        ]);

        $candidate->update([
            'status'           => TravelToilCandidate::STATUS_PENDING_SUPERVISOR,
            'ot_authorised_at' => now(),
            'ot_authorised_by' => $user->id,
        ]);

        return $candidate->fresh();
    }

    /**
     * Employee confirms what actually happened on a detected non-working day.
     * "did_not_work" auto-rejects — a trip crossing a weekend does not by itself
     * earn TOIL. "worked"/"travelled" moves the candidate into supervisor review,
     * i.e. today's original flow starts here instead of at generation time.
     */
    public function confirmByEmployee(
        TravelToilCandidate $candidate,
        User $user,
        string $confirmation,
        ?string $comment = null,
    ): TravelToilCandidate {
        if ($candidate->user_id !== $user->id) {
            abort(403, 'Only the traveller may confirm this TOIL candidate.');
        }

        if (! $candidate->awaitsEmployee()) {
            throw ValidationException::withMessages([
                'status' => 'This TOIL candidate is not awaiting employee confirmation.',
            ]);
        }

        if (! in_array($confirmation, [
            TravelToilCandidate::EMPLOYEE_CONFIRMATION_WORKED,
            TravelToilCandidate::EMPLOYEE_CONFIRMATION_TRAVELLED,
            TravelToilCandidate::EMPLOYEE_CONFIRMATION_DID_NOT_WORK,
        ], true)) {
            throw ValidationException::withMessages([
                'confirmation' => 'Invalid confirmation value.',
            ]);
        }

        if ($confirmation === TravelToilCandidate::EMPLOYEE_CONFIRMATION_DID_NOT_WORK) {
            $candidate->update([
                'employee_confirmed_at'  => now(),
                'employee_confirmation'  => $confirmation,
                'employee_comment'       => $comment,
                'status'                 => TravelToilCandidate::STATUS_REJECTED,
                'rejection_reason'       => 'Employee confirmed no qualifying duty was performed.',
            ]);

            AuditLog::record('travel.toil_employee_declined', [
                'auditable_type' => TravelToilCandidate::class,
                'auditable_id'   => $candidate->id,
                'new_values'     => ['confirmation' => $confirmation, 'leave_credited' => false],
                'tags'           => 'travel,toil',
            ]);

            return $candidate->fresh();
        }

        $candidate->update([
            'employee_confirmed_at' => now(),
            'employee_confirmation' => $confirmation,
            'employee_comment'      => $comment,
            'status'                => TravelToilCandidate::STATUS_PENDING_SUPERVISOR,
        ]);

        AuditLog::record('travel.toil_employee_confirmed', [
            'auditable_type' => TravelToilCandidate::class,
            'auditable_id'   => $candidate->id,
            'new_values'     => ['confirmation' => $confirmation],
            'tags'           => 'travel,toil',
        ]);

        $traveller = $candidate->user;
        $travel = $candidate->travelRequest;
        if ($traveller && $travel) {
            $this->notifyCandidateStakeholders($travel, $traveller, 1);
        }

        return $candidate->fresh();
    }

    /**
     * Supervisor confirms actual duty performed → pending HR validation.
     */
    public function confirmDuty(TravelToilCandidate $candidate, User $user): TravelToilCandidate
    {
        $this->assertStatus($candidate, [
            TravelToilCandidate::STATUS_PENDING_SUPERVISOR,
            TravelToilCandidate::STATUS_OT_AUTHORISED,
            'candidate',
        ]);

        $candidate->update([
            'status'            => TravelToilCandidate::STATUS_PENDING_HR,
            'duty_confirmed_at' => now(),
            'duty_confirmed_by' => $user->id,
            'ot_authorised_at'  => $candidate->ot_authorised_at ?? now(),
            'ot_authorised_by'  => $candidate->ot_authorised_by ?? $user->id,
        ]);

        $this->notifyHrPending($candidate);

        return $candidate->fresh();
    }

    /**
     * HR validate entitlement / OT rules → credit OvertimeAccrual (Leave module).
     * Never creates LeaveRequest.
     */
    public function hrValidateAndCredit(TravelToilCandidate $candidate, User $user): TravelToilCandidate
    {
        if ($candidate->awaitsSupervisor() || $candidate->status === TravelToilCandidate::STATUS_PENDING_SUPERVISOR) {
            throw ValidationException::withMessages([
                'status' => 'Supervisor must confirm duty before HR can validate TOIL.',
            ]);
        }

        if (! $candidate->awaitsHr() && $candidate->status !== 'duty_confirmed') {
            throw ValidationException::withMessages([
                'status' => 'Invalid TOIL candidate status for HR validation: ' . $candidate->status,
            ]);
        }

        if (config('travel.auto_create_leave_from_travel')) {
            throw new \RuntimeException('auto_create_leave_from_travel must remain false');
        }

        return DB::transaction(function () use ($candidate, $user) {
            $expiryDays = $this->tenantToilExpiryDays($candidate->tenant_id);
            $accrualDate = Carbon::parse($candidate->candidate_date)->startOfDay();
            $expiresAt = $accrualDate->copy()->addDays($expiryDays)->toDateString();

            $accrual = OvertimeAccrual::create([
                'user_id'          => $candidate->user_id,
                'code'             => 'TOIL-TRV-' . $candidate->travel_request_id . '-' . $accrualDate->format('Ymd'),
                'description'      => 'Travel TOIL candidate ' . $accrualDate->format('Y-m-d') . ' (' . ($candidate->reason ?? 'mission') . ')',
                'hours'            => $candidate->hours,
                'accrual_date'     => $accrualDate->toDateString(),
                'expires_at'       => $expiresAt,
                'approved_by_name' => $user->name,
                'is_verified'      => true,
                'is_linked'        => false,
            ]);

            $candidate->update([
                'status'              => TravelToilCandidate::STATUS_CREDITED,
                'hr_validated_at'     => now(),
                'hr_validated_by'     => $user->id,
                'credited_at'         => now(),
                'overtime_accrual_id' => $accrual->id,
                'expires_at'          => $expiresAt,
            ]);

            AuditLog::record('travel.toil_credited', [
                'auditable_type' => TravelToilCandidate::class,
                'auditable_id'   => $candidate->id,
                'new_values'     => [
                    'overtime_accrual_id' => $accrual->id,
                    'expires_at'          => $expiresAt,
                    'leave_created'       => false,
                    'leave_request_count_delta' => 0,
                ],
                'tags' => 'travel,toil',
            ]);

            $traveller = $candidate->user;
            if ($traveller) {
                $this->notificationService->dispatch($traveller, 'travel.toil_credited', [
                    'name' => $traveller->name,
                    'reference' => $candidate->travelRequest?->reference_number ?? (string) $candidate->travel_request_id,
                    'hours' => (string) $candidate->hours,
                    'expires_at' => $expiresAt,
                ], [
                    'module' => 'travel',
                    'record_id' => $candidate->travel_request_id,
                    'url' => '/travel/toil',
                ]);
            }

            return $candidate->fresh(['overtimeAccrual']);
        });
    }

    public function reject(TravelToilCandidate $candidate, string $reason, User $user): TravelToilCandidate
    {
        if (in_array($candidate->status, TravelToilCandidate::TERMINAL_STATUSES, true)) {
            throw ValidationException::withMessages([
                'status' => 'Cannot reject a TOIL candidate in status ' . $candidate->status,
            ]);
        }

        $candidate->update([
            'status'           => TravelToilCandidate::STATUS_REJECTED,
            'rejection_reason' => $reason,
            'hr_validated_by'  => $user->id,
            'hr_validated_at'  => now(),
        ]);

        AuditLog::record('travel.toil_rejected', [
            'auditable_type' => TravelToilCandidate::class,
            'auditable_id'   => $candidate->id,
            'new_values'     => ['reason' => $reason, 'leave_credited' => false],
            'tags'           => 'travel,toil',
        ]);

        return $candidate->fresh();
    }

    /**
     * SG extends TOIL accrual expiry (default window is accrual_date + 30 days).
     */
    public function extendExpiry(
        TravelToilCandidate $candidate,
        User $user,
        ?string $newExpiry = null,
        ?string $reason = null,
    ): TravelToilCandidate {
        if (! $user->hasRole('Secretary General') && ! $user->isSystemAdmin()) {
            abort(403, 'Only the Secretary General may extend TOIL expiry.');
        }

        if (! in_array($candidate->status, [
            TravelToilCandidate::STATUS_CREDITED,
            TravelToilCandidate::STATUS_EXTENDED,
            TravelToilCandidate::STATUS_EXPIRED,
        ], true)) {
            throw ValidationException::withMessages([
                'status' => 'Only credited, extended, or expired TOIL can be extended by SG.',
            ]);
        }

        if ($reason === null || trim($reason) === '') {
            throw ValidationException::withMessages([
                'reason' => 'A reason is required when the Secretary General extends TOIL expiry.',
            ]);
        }

        $expiresAt = $newExpiry
            ?? now()->addDays($this->tenantToilExpiryDays($candidate->tenant_id))->toDateString();

        $candidate->update([
            'status'           => TravelToilCandidate::STATUS_EXTENDED,
            'expires_at'       => $expiresAt,
            'sg_extended_at'   => now(),
            'sg_extended_by'   => $user->id,
            'sg_extend_reason' => $reason,
        ]);

        if ($candidate->overtime_accrual_id) {
            OvertimeAccrual::where('id', $candidate->overtime_accrual_id)->update(['expires_at' => $expiresAt]);
        }

        AuditLog::record('travel.toil_expiry_extended', [
            'auditable_type' => TravelToilCandidate::class,
            'auditable_id'   => $candidate->id,
            'new_values'     => [
                'expires_at' => $expiresAt,
                'reason' => $reason,
                'approver_id' => $user->id,
            ],
            'tags'           => 'travel,toil',
        ]);

        return $candidate->fresh();
    }

    private function notifyEmployeeConfirmationRequired(TravelRequest $travel, User $traveller, int $count): void
    {
        $this->notificationService->dispatch($traveller, 'travel.toil_candidate', [
            'name' => $traveller->name,
            'reference' => $travel->reference_number,
            'traveller' => $traveller->name,
            'count' => (string) $count,
        ], [
            'module' => 'travel',
            'record_id' => $travel->id,
            'url' => '/travel/toil/mine',
        ]);
    }

    private function notifyCandidateStakeholders(TravelRequest $travel, User $traveller, int $count): void
    {
        $meta = [
            'module' => 'travel',
            'record_id' => $travel->id,
            'url' => '/travel/toil',
        ];
        $vars = [
            'reference' => $travel->reference_number,
            'traveller' => $traveller->name,
            'count' => (string) $count,
        ];

        $recipients = $this->approvalRecipients($traveller, $travel->tenant_id);
        if ($recipients->isNotEmpty()) {
            $this->notificationService->dispatchToMany(
                $recipients,
                'travel.toil_approval_required',
                $vars,
                $meta
            );
        }
    }

    private function notifyHrPending(TravelToilCandidate $candidate): void
    {
        $travel = $candidate->travelRequest;
        $traveller = $candidate->user;
        if (! $travel || ! $traveller) {
            return;
        }

        $hrUsers = User::role(['HR Manager', 'HR Administrator'])
            ->where('tenant_id', $travel->tenant_id)
            ->where('is_active', true)
            ->get();

        if ($hrUsers->isEmpty()) {
            return;
        }

        $this->notificationService->dispatchToMany($hrUsers, 'travel.toil_hr_validation_required', [
            'reference' => $travel->reference_number,
            'traveller' => $traveller->name,
            'date' => Carbon::parse($candidate->candidate_date)->toDateString(),
            'hours' => (string) $candidate->hours,
        ], [
            'module' => 'travel',
            'record_id' => $travel->id,
            'url' => '/travel/toil',
        ]);
    }

    private function approvalRecipients(User $traveller, int $tenantId)
    {
        $ids = collect();

        $supervisor = $this->resolveSupervisor($traveller);
        if ($supervisor) {
            $ids->push($supervisor->id);
        }

        $roleUsers = User::role(['HR Manager', 'HR Administrator', 'HOD'])
            ->where('tenant_id', $tenantId)
            ->where('is_active', true)
            ->pluck('id');

        $ids = $ids->merge($roleUsers)->unique()->filter(fn ($id) => $id !== $traveller->id);

        return User::whereIn('id', $ids)->get();
    }

    private function resolveSupervisor(User $user): ?User
    {
        if (! $user->department_id) {
            return null;
        }

        $dept = Department::with('supervisor')->find($user->department_id);
        while ($dept && ! $dept->supervisor_id) {
            if (! $dept->parent_id) {
                break;
            }
            $dept = Department::with('supervisor')->find($dept->parent_id);
        }

        return $dept?->supervisor;
    }

    private function tenantToilExpiryDays(int $tenantId): int
    {
        $value = TenantSetting::forTenant($tenantId)['toil_expiry_days'] ?? null;

        return is_numeric($value) ? (int) $value : (int) config('travel.toil_expiry_days', 30);
    }

    private function assertStatus(TravelToilCandidate $candidate, array $allowed): void
    {
        if (! in_array($candidate->status, $allowed, true)) {
            throw ValidationException::withMessages([
                'status' => 'Invalid TOIL candidate status transition from ' . $candidate->status,
            ]);
        }
    }
}
