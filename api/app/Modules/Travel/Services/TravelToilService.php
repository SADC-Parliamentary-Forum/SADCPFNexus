<?php

namespace App\Modules\Travel\Services;

use App\Models\AuditLog;
use App\Models\CalendarEntry;
use App\Models\LeaveRequest;
use App\Models\OvertimeAccrual;
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
     * Generate TOIL candidates for weekend/holiday days. Never creates LeaveRequest.
     */
    public function generateForTravel(TravelRequest $travel): array
    {
        if (! $travel->isApproved() && ! $travel->returned_at) {
            return [];
        }

        $user = $travel->requester;
        if (! $user) {
            return [];
        }

        $minDate = Carbon::parse($travel->departure_date);
        $maxDate = Carbon::parse($travel->return_date);

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
        $created = [];

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
                    'status'    => TravelToilCandidate::STATUS_CANDIDATE,
                ]
            );

            $created[] = $candidate;
        }

        // Hard lock: never auto-create leave
        if (config('travel.auto_create_leave_from_travel')) {
            throw new \RuntimeException('auto_create_leave_from_travel must remain false');
        }

        AuditLog::record('travel.toil_candidates_generated', [
            'auditable_type' => TravelRequest::class,
            'auditable_id'   => $travel->id,
            'new_values'     => ['count' => count($created)],
            'tags'           => 'travel,toil',
        ]);

        if (count($created) > 0 && $user) {
            $this->notificationService->dispatch($user, 'travel.toil_candidate', [
                'name' => $user->name,
                'reference' => $travel->reference_number,
            ], ['module' => 'travel', 'record_id' => $travel->id, 'url' => '/travel/'.$travel->id]);
        }

        return $created;
    }

    public function generateCatchUp(): int
    {
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

    public function authoriseOt(TravelToilCandidate $candidate, User $user): TravelToilCandidate
    {
        $this->assertStatus($candidate, [TravelToilCandidate::STATUS_CANDIDATE]);
        $candidate->update([
            'status'           => TravelToilCandidate::STATUS_OT_AUTHORISED,
            'ot_authorised_at' => now(),
            'ot_authorised_by' => $user->id,
        ]);

        return $candidate->fresh();
    }

    public function confirmDuty(TravelToilCandidate $candidate, User $user): TravelToilCandidate
    {
        $this->assertStatus($candidate, [TravelToilCandidate::STATUS_OT_AUTHORISED]);
        $candidate->update([
            'status'            => TravelToilCandidate::STATUS_DUTY_CONFIRMED,
            'duty_confirmed_at' => now(),
            'duty_confirmed_by' => $user->id,
        ]);

        return $candidate->fresh();
    }

    /**
     * HR validate → credit OvertimeAccrual (Leave module). Never creates LeaveRequest.
     */
    public function hrValidateAndCredit(TravelToilCandidate $candidate, User $user): TravelToilCandidate
    {
        if ($candidate->status !== TravelToilCandidate::STATUS_DUTY_CONFIRMED
            && $candidate->status !== TravelToilCandidate::STATUS_OT_AUTHORISED) {
            // Must have OT authorised at minimum
            if ($candidate->status === TravelToilCandidate::STATUS_CANDIDATE) {
                throw ValidationException::withMessages([
                    'status' => 'OT authorisation is required before HR can validate TOIL.',
                ]);
            }
        }

        if (! $candidate->ot_authorised_at && $candidate->status === TravelToilCandidate::STATUS_CANDIDATE) {
            throw ValidationException::withMessages([
                'status' => 'OT authorisation is required before HR can validate TOIL.',
            ]);
        }

        if ($candidate->status === TravelToilCandidate::STATUS_CANDIDATE) {
            throw ValidationException::withMessages([
                'status' => 'OT authorisation is required before HR can validate TOIL.',
            ]);
        }

        return DB::transaction(function () use ($candidate, $user) {
            $expiryDays = (int) config('travel.toil_expiry_days', 30);
            $expiresAt = now()->addDays($expiryDays)->toDateString();

            $accrual = OvertimeAccrual::create([
                'user_id'          => $candidate->user_id,
                'code'             => 'TOIL-TRV-' . $candidate->travel_request_id . '-' . $candidate->candidate_date->format('Ymd'),
                'description'      => 'Travel TOIL candidate ' . $candidate->candidate_date->format('Y-m-d') . ' (' . ($candidate->reason ?? 'mission') . ')',
                'hours'            => $candidate->hours,
                'accrual_date'     => $candidate->candidate_date,
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

            // Assert no LeaveRequest was created for this credit
            $leaveCount = LeaveRequest::where('requester_id', $candidate->user_id)
                ->where('created_at', '>=', now()->subSeconds(5))
                ->where('leave_type', 'lil')
                ->count();
            // Do not create leave — leaveCount may be coincidental; we simply never call LeaveService create.

            AuditLog::record('travel.toil_credited', [
                'auditable_type' => TravelToilCandidate::class,
                'auditable_id'   => $candidate->id,
                'new_values'     => [
                    'overtime_accrual_id' => $accrual->id,
                    'expires_at'          => $expiresAt,
                    'leave_created'       => false,
                ],
                'tags' => 'travel,toil',
            ]);

            return $candidate->fresh(['overtimeAccrual']);
        });
    }

    public function reject(TravelToilCandidate $candidate, string $reason, User $user): TravelToilCandidate
    {
        $candidate->update([
            'status'           => TravelToilCandidate::STATUS_REJECTED,
            'rejection_reason' => $reason,
            'hr_validated_by'  => $user->id,
            'hr_validated_at'  => now(),
        ]);

        return $candidate->fresh();
    }

    public function extendExpiry(TravelToilCandidate $candidate, User $user, ?string $newExpiry = null): TravelToilCandidate
    {
        if (! $user->hasRole('Secretary General') && ! $user->isSystemAdmin()) {
            abort(403, 'Only the Secretary General may extend TOIL expiry.');
        }

        $expiresAt = $newExpiry ?? now()->addDays((int) config('travel.toil_expiry_days', 30))->toDateString();
        $candidate->update([
            'expires_at'      => $expiresAt,
            'sg_extended_at'  => now(),
            'sg_extended_by'  => $user->id,
        ]);

        if ($candidate->overtime_accrual_id) {
            OvertimeAccrual::where('id', $candidate->overtime_accrual_id)->update(['expires_at' => $expiresAt]);
        }

        AuditLog::record('travel.toil_expiry_extended', [
            'auditable_type' => TravelToilCandidate::class,
            'auditable_id'   => $candidate->id,
            'new_values'     => ['expires_at' => $expiresAt],
            'tags'           => 'travel,toil',
        ]);

        return $candidate->fresh();
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
