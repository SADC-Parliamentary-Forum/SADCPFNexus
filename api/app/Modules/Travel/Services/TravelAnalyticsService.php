<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelFundingLine;
use App\Models\TravelRequest;
use App\Models\User;
use Illuminate\Support\Facades\DB;

class TravelAnalyticsService
{
    public function summary(User $user): array
    {
        $tenantId = $user->tenant_id;

        $byStatus = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        $costByProgramme = TravelRequest::query()
            ->where('travel_requests.tenant_id', $tenantId)
            ->whereNotNull('programme_id')
            ->leftJoin('programmes', 'programmes.id', '=', 'travel_requests.programme_id')
            ->select(
                'travel_requests.programme_id',
                'programmes.title as programme_title',
                'programmes.reference_number as programme_reference',
                DB::raw('count(travel_requests.id) as travel_count'),
                DB::raw('coalesce(sum(coalesce(travel_requests.finance_dsa_total, travel_requests.estimated_dsa, 0)), 0) as dsa_total')
            )
            ->groupBy('travel_requests.programme_id', 'programmes.title', 'programmes.reference_number')
            ->orderByDesc('dsa_total')
            ->get()
            ->map(fn ($row) => [
                'programme_id' => (int) $row->programme_id,
                'programme_title' => $row->programme_title,
                'programme_reference' => $row->programme_reference,
                'travel_count' => (int) $row->travel_count,
                'dsa_total' => (float) $row->dsa_total,
            ])
            ->all();

        $costByFundingAgency = TravelFundingLine::query()
            ->join('travel_requests', 'travel_requests.id', '=', 'travel_funding_lines.travel_request_id')
            ->where('travel_requests.tenant_id', $tenantId)
            ->whereNotNull('travel_funding_lines.funding_agency')
            ->where('travel_funding_lines.funding_agency', '!=', '')
            ->select(
                'travel_funding_lines.funding_agency',
                DB::raw('sum(travel_funding_lines.forum_amount + travel_funding_lines.host_amount) as amount_total'),
                DB::raw('count(distinct travel_funding_lines.travel_request_id) as travel_count')
            )
            ->groupBy('travel_funding_lines.funding_agency')
            ->orderByDesc('amount_total')
            ->get()
            ->map(fn ($row) => [
                'funding_agency' => $row->funding_agency,
                'amount_total' => (float) $row->amount_total,
                'travel_count' => (int) $row->travel_count,
            ])
            ->all();

        return [
            'by_status' => $byStatus,
            'cost_by_programme' => $costByProgramme,
            'cost_by_funding_agency' => $costByFundingAgency,
            'totals' => [
                'requests' => array_sum(array_map('intval', $byStatus)),
                'finance_dsa_total' => (float) TravelRequest::where('tenant_id', $tenantId)->sum('finance_dsa_total'),
                'estimated_dsa_total' => (float) TravelRequest::where('tenant_id', $tenantId)->sum('estimated_dsa'),
            ],
        ];
    }
}
