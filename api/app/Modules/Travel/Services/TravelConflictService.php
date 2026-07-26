<?php

namespace App\Modules\Travel\Services;

use App\Models\LeaveRequest;
use App\Models\TravelRequest;
use App\Models\User;
use Carbon\Carbon;

class TravelConflictService
{
    /**
     * Detect leave / overlapping travel conflicts for a travel request.
     *
     * @return list<array{type:string,message:string,reference:?string,id:?int}>
     */
    public function detectForTravel(TravelRequest $travel): array
    {
        $from = Carbon::parse($travel->departure_date)->startOfDay();
        $to = Carbon::parse($travel->return_date)->endOfDay();
        $userId = (int) $travel->requester_id;
        $conflicts = [];

        $leaves = LeaveRequest::query()
            ->where('tenant_id', $travel->tenant_id)
            ->where('requester_id', $userId)
            ->whereIn('status', ['approved', 'submitted', 'resubmitted'])
            ->whereDate('start_date', '<=', $to->toDateString())
            ->whereDate('end_date', '>=', $from->toDateString())
            ->get();

        foreach ($leaves as $leave) {
            $conflicts[] = [
                'type' => 'leave',
                'message' => sprintf(
                    'Overlapping leave %s (%s–%s, %s)',
                    $leave->reference_number,
                    $leave->start_date?->toDateString(),
                    $leave->end_date?->toDateString(),
                    $leave->leave_type
                ),
                'reference' => $leave->reference_number,
                'id' => $leave->id,
            ];
        }

        $otherTravel = TravelRequest::query()
            ->where('tenant_id', $travel->tenant_id)
            ->where('requester_id', $userId)
            ->where('id', '!=', $travel->id)
            ->whereIn('status', ['approved', 'submitted', 'resubmitted'])
            ->whereDate('departure_date', '<=', $to->toDateString())
            ->whereDate('return_date', '>=', $from->toDateString())
            ->get();

        foreach ($otherTravel as $other) {
            $conflicts[] = [
                'type' => 'travel',
                'message' => sprintf(
                    'Overlapping travel %s (%s–%s, %s)',
                    $other->reference_number,
                    $other->departure_date?->toDateString(),
                    $other->return_date?->toDateString(),
                    $other->destination_country
                ),
                'reference' => $other->reference_number,
                'id' => $other->id,
            ];
        }

        return $conflicts;
    }

    /**
     * Detect approved travel overlapping a leave window.
     *
     * @return list<array{type:string,message:string,reference:?string,id:?int}>
     */
    public function detectForLeave(User $user, string $startDate, string $endDate, ?int $ignoreLeaveId = null): array
    {
        $from = Carbon::parse($startDate)->startOfDay();
        $to = Carbon::parse($endDate)->endOfDay();
        $conflicts = [];

        $travels = TravelRequest::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted', 'resubmitted'])
            ->whereDate('departure_date', '<=', $to->toDateString())
            ->whereDate('return_date', '>=', $from->toDateString())
            ->get();

        foreach ($travels as $travel) {
            $conflicts[] = [
                'type' => 'travel',
                'message' => sprintf(
                    'Overlapping approved/submitted travel %s (%s–%s)',
                    $travel->reference_number,
                    $travel->departure_date?->toDateString(),
                    $travel->return_date?->toDateString()
                ),
                'reference' => $travel->reference_number,
                'id' => $travel->id,
            ];
        }

        return $conflicts;
    }
}
