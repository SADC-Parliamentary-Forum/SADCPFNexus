<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelRequest;
use App\Models\User;
use Carbon\Carbon;

class TravelCalendarService
{
    /**
     * @return list<array{id:int,type:string,date:string,title:string,reference:string,traveller:?string,destination:?string,status:string}>
     */
    public function events(User $user, string $from, string $to): array
    {
        $canViewAll = $user->isSystemAdmin()
            || $user->hasAnyRole(['Secretary General', 'HR Manager', 'Finance Controller', 'Director', 'Administration Officer', 'HOD'])
            || $user->can('travel.admin')
            || $user->can('travel.view');

        $query = TravelRequest::with('requester')
            ->where('tenant_id', $user->tenant_id)
            ->whereIn('status', ['approved', 'submitted', 'resubmitted'])
            ->where(function ($q) use ($from, $to) {
                $q->whereDate('departure_date', '<=', $to)
                    ->whereDate('return_date', '>=', $from);
            });

        if (! $canViewAll) {
            $query->where(function ($q) use ($user) {
                $q->where('requester_id', $user->id)
                    ->orWhere('prepared_by', $user->id)
                    ->orWhere('prepared_on_behalf_of', $user->id);
            });
        }

        $events = [];
        $today = Carbon::today();

        foreach ($query->get() as $travel) {
            $dep = $travel->departure_date?->toDateString();
            $ret = $travel->return_date?->toDateString();
            $title = $travel->purpose ?: $travel->destination_country;
            $base = [
                'id' => $travel->id,
                'title' => $title,
                'reference' => $travel->reference_number,
                'traveller' => $travel->requester?->name,
                'destination' => trim(($travel->destination_city ? $travel->destination_city.', ' : '').($travel->destination_country ?? ''), ', '),
                'status' => $travel->status,
                'mission_id' => $travel->mission_id,
            ];

            if ($travel->status === 'approved') {
                $events[] = array_merge($base, ['type' => 'approved', 'date' => $dep]);
                if ($dep) {
                    $events[] = array_merge($base, ['type' => 'departure', 'date' => $dep]);
                }
                if ($ret) {
                    $events[] = array_merge($base, ['type' => 'return', 'date' => $ret]);
                }
                if ($dep && $ret
                    && $today->toDateString() >= $dep
                    && $today->toDateString() <= $ret) {
                    $events[] = array_merge($base, ['type' => 'away', 'date' => $today->toDateString()]);
                }
            } else {
                $events[] = array_merge($base, ['type' => 'pending', 'date' => $dep]);
            }
        }

        usort($events, fn ($a, $b) => strcmp($a['date'] ?? '', $b['date'] ?? ''));

        return $events;
    }
}
