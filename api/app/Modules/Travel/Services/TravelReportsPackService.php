<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelAmendment;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;

class TravelReportsPackService
{
    public function pack(User $user): array
    {
        $tenantId = $user->tenant_id;
        $today = Carbon::today()->toDateString();

        $register = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->with('requester:id,name')
            ->orderByDesc('departure_date')
            ->limit(500)
            ->get(['id', 'reference_number', 'requester_id', 'status', 'purpose', 'destination_country', 'destination_city', 'departure_date', 'return_date', 'finance_dsa_total', 'programme_id']);

        $upcoming = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved')
            ->whereDate('departure_date', '>', $today)
            ->orderBy('departure_date')
            ->limit(200)
            ->get(['id', 'reference_number', 'requester_id', 'destination_country', 'departure_date', 'return_date']);

        $current = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->where('status', 'approved')
            ->whereDate('departure_date', '<=', $today)
            ->whereDate('return_date', '>=', $today)
            ->get(['id', 'reference_number', 'requester_id', 'destination_country', 'departure_date', 'return_date']);

        $outstandingRetirement = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('returned_at')
            ->where(function ($q) {
                $q->whereNull('retirement_status')
                    ->orWhereNotIn('retirement_status', ['completed', 'retired']);
            })
            ->get(['id', 'reference_number', 'requester_id', 'returned_at', 'retirement_due_at', 'retirement_status']);

        $toil = TravelToilCandidate::query()
            ->where('tenant_id', $tenantId)
            ->orderByDesc('candidate_date')
            ->limit(500)
            ->get(['id', 'travel_request_id', 'user_id', 'candidate_date', 'reason', 'status', 'hours', 'expires_at']);

        $visa = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('visa_required', true)->orWhereNotNull('visa_status');
            })
            ->get(['id', 'reference_number', 'requester_id', 'visa_required', 'visa_status', 'visa_expiry_date', 'departure_date']);

        $amendments = TravelAmendment::query()
            ->whereHas('travelRequest', fn ($q) => $q->where('tenant_id', $tenantId))
            ->orderByDesc('created_at')
            ->limit(200)
            ->get();

        $byDestination = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->select('destination_country', DB::raw('count(*) as travel_count'), DB::raw('coalesce(sum(coalesce(finance_dsa_total, estimated_dsa, 0)), 0) as cost_total'))
            ->groupBy('destination_country')
            ->orderByDesc('cost_total')
            ->get();

        $byTraveller = TravelRequest::query()
            ->where('travel_requests.tenant_id', $tenantId)
            ->join('users', 'users.id', '=', 'travel_requests.requester_id')
            ->select('travel_requests.requester_id', 'users.name as traveller', DB::raw('count(*) as travel_count'), DB::raw('coalesce(sum(coalesce(travel_requests.finance_dsa_total, travel_requests.estimated_dsa, 0)), 0) as cost_total'))
            ->groupBy('travel_requests.requester_id', 'users.name')
            ->orderByDesc('cost_total')
            ->limit(100)
            ->get();

        return [
            'travel_register' => $register,
            'upcoming_travel' => $upcoming,
            'current_travellers' => $current,
            'outstanding_retirement' => $outstandingRetirement,
            'toil_candidates' => $toil,
            'visa_status' => $visa,
            'amendments' => $amendments,
            'cost_by_destination' => $byDestination,
            'cost_by_traveller' => $byTraveller,
        ];
    }
}
