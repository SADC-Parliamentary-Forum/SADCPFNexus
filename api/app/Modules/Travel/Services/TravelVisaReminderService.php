<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelRequest;
use App\Models\User;
use App\Services\NotificationService;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class TravelVisaReminderService
{
    public const APPOINTMENT_WINDOW_DAYS = 7;

    public const EXPIRY_WINDOW_DAYS = 30;

    public function __construct(
        private readonly NotificationService $notificationService,
    ) {}

    public function watchlist(User $user): Collection
    {
        return $this->dueQuery($user->tenant_id)->with(['requester'])->get();
    }

    public function updateVisa(TravelRequest $travel, array $data, User $user): TravelRequest
    {
        abort_unless((int) $travel->tenant_id === (int) $user->tenant_id, 404);
        abort_unless(
            $user->can('travel.admin-review')
                || $user->can('travel.admin')
                || $user->can('travel.finance-review')
                || $user->isSystemAdmin()
                || $user->hasAnyRole(['Administration Officer', 'Finance Controller', 'HR Manager', 'System Admin'])
                || (int) $travel->requester_id === (int) $user->id,
            403
        );

        $travel->update([
            'visa_required' => (bool) ($data['visa_required'] ?? $travel->visa_required),
            'visa_status' => $data['visa_status'] ?? $travel->visa_status,
            'visa_expiry_date' => $data['visa_expiry_date'] ?? $travel->visa_expiry_date,
            'visa_appointment_date' => $data['visa_appointment_date'] ?? $travel->visa_appointment_date,
            'visa_notes' => $data['visa_notes'] ?? $travel->visa_notes,
        ]);

        return $travel->fresh(['requester']);
    }

    public function sendDueReminders(?int $tenantId = null): int
    {
        $sent = 0;
        $query = $this->dueQuery($tenantId)->with(['requester']);

        foreach ($query->get() as $travel) {
            /** @var TravelRequest $travel */
            if ($travel->visa_last_reminded_at && $travel->visa_last_reminded_at->isAfter(now()->subDay())) {
                continue;
            }

            $recipient = $travel->requester;
            if (! $recipient) {
                continue;
            }

            $reason = $this->reminderReason($travel);
            $this->notificationService->dispatch(
                $recipient,
                'travel.visa_reminder',
                [
                    'name' => $recipient->name,
                    'reference' => $travel->reference_number,
                    'destination' => trim(($travel->destination_city ? $travel->destination_city.', ' : '').($travel->destination_country ?? '')),
                    'visa_status' => $travel->visa_status ?? 'pending',
                    'appointment_date' => optional($travel->visa_appointment_date)->toDateString() ?? '—',
                    'expiry_date' => optional($travel->visa_expiry_date)->toDateString() ?? '—',
                    'reason' => $reason,
                ],
                [
                    'module' => 'travel',
                    'record_id' => $travel->id,
                    'url' => '/travel/'.$travel->id,
                ]
            );

            $travel->update(['visa_last_reminded_at' => now()]);
            $sent++;
        }

        return $sent;
    }

    private function dueQuery(?int $tenantId = null)
    {
        $appointmentBefore = Carbon::today()->addDays(self::APPOINTMENT_WINDOW_DAYS);
        $expiryBefore = Carbon::today()->addDays(self::EXPIRY_WINDOW_DAYS);

        $q = TravelRequest::query()
            ->where('visa_required', true)
            ->whereNotIn('status', ['cancelled', 'withdrawn', 'rejected'])
            ->where(function ($inner) use ($appointmentBefore, $expiryBefore) {
                $inner->where(function ($a) use ($appointmentBefore) {
                    $a->whereIn('visa_status', ['pending', 'appointment_scheduled', 'submitted'])
                        ->whereNotNull('visa_appointment_date')
                        ->whereDate('visa_appointment_date', '<=', $appointmentBefore);
                })->orWhere(function ($e) use ($expiryBefore) {
                    $e->whereNotNull('visa_expiry_date')
                        ->whereDate('visa_expiry_date', '<=', $expiryBefore)
                        ->where(function ($status) {
                            $status->whereNull('visa_status')
                                ->orWhereNotIn('visa_status', ['not_required', 'rejected']);
                        });
                })->orWhereIn('visa_status', ['pending', 'appointment_scheduled']);
            });

        if ($tenantId) {
            $q->where('tenant_id', $tenantId);
        }

        return $q;
    }

    private function reminderReason(TravelRequest $travel): string
    {
        $parts = [];
        if ($travel->visa_appointment_date && $travel->visa_appointment_date->lte(Carbon::today()->addDays(self::APPOINTMENT_WINDOW_DAYS))) {
            $parts[] = 'upcoming visa appointment';
        }
        if ($travel->visa_expiry_date && $travel->visa_expiry_date->lte(Carbon::today()->addDays(self::EXPIRY_WINDOW_DAYS))) {
            $parts[] = 'visa expiry approaching';
        }
        if (in_array($travel->visa_status, ['pending', 'appointment_scheduled'], true) && empty($parts)) {
            $parts[] = 'visa still pending';
        }

        return implode('; ', $parts) ?: 'visa follow-up required';
    }
}
