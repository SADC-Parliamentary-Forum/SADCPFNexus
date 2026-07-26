<?php

namespace App\Modules\Travel\Services;

use App\Models\Attachment;
use App\Models\TravelMission;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Contracts\Pagination\LengthAwarePaginator;

class TravelMissionService
{
    public function list(User $user, array $filters = []): LengthAwarePaginator
    {
        $q = TravelMission::query()
            ->where('tenant_id', $user->tenant_id)
            ->withCount('requests')
            ->orderByDesc('start_date')
            ->orderByDesc('id');

        if (! empty($filters['search'])) {
            $s = $filters['search'];
            $q->where(function ($inner) use ($s) {
                $inner->where('title', 'ilike', "%{$s}%")
                    ->orWhere('destination_city', 'ilike', "%{$s}%")
                    ->orWhere('destination_country', 'ilike', "%{$s}%");
            });
        }

        return $q->paginate($filters['per_page'] ?? 20);
    }

    public function showWithReadiness(TravelMission $mission, User $user): array
    {
        abort_unless((int) $mission->tenant_id === (int) $user->tenant_id, 404);

        $mission->load(['programme', 'requests.requester', 'requests.attachments', 'requests.dsaLines']);

        $travellers = $mission->requests->map(fn (TravelRequest $travel) => $this->readinessRow($travel))->values()->all();

        $readyCount = collect($travellers)->where('ready', true)->count();

        return [
            'mission' => $mission,
            'summary' => [
                'travellers' => count($travellers),
                'ready' => $readyCount,
                'pending' => count($travellers) - $readyCount,
            ],
            'travellers' => $travellers,
        ];
    }

    public function readinessRow(TravelRequest $travel): array
    {
        $types = $travel->relationLoaded('attachments')
            ? $travel->attachments->pluck('document_type')->all()
            : $travel->attachments()->pluck('document_type')->all();

        $ticket = in_array(Attachment::DOCUMENT_TYPE_FLIGHT_TICKET, $types, true);
        $hotel = in_array(Attachment::DOCUMENT_TYPE_HOTEL_BOOKING, $types, true);
        $visaDoc = in_array(Attachment::DOCUMENT_TYPE_VISA_COPY, $types, true);

        $visa = $this->visaReady($travel, $visaDoc);
        $dsa = $this->dsaReady($travel);
        $ready = $ticket && $visa && $hotel && $dsa;

        return [
            'travel_request_id' => $travel->id,
            'reference_number' => $travel->reference_number,
            'traveller' => $travel->requester?->name,
            'status' => $travel->status,
            'ticket' => $ticket,
            'visa' => $visa,
            'visa_status' => $travel->visa_status,
            'hotel' => $hotel,
            'dsa' => $dsa,
            'finance_status' => $travel->finance_status,
            'finance_dsa_total' => $travel->finance_dsa_total,
            'ready' => $ready,
        ];
    }

    private function visaReady(TravelRequest $travel, bool $hasVisaCopy): bool
    {
        if (! $travel->visa_required || $travel->visa_status === 'not_required') {
            return true;
        }

        if ($travel->visa_status === 'approved') {
            return true;
        }

        return $hasVisaCopy;
    }

    private function dsaReady(TravelRequest $travel): bool
    {
        if (in_array($travel->finance_status, ['dsa_calculated', 'funds_confirmed', 'confirmed'], true)) {
            return true;
        }

        return $travel->finance_dsa_total !== null && (float) $travel->finance_dsa_total > 0;
    }
}
