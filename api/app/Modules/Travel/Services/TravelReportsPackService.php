<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelAmendment;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TravelReportsPackService
{
    public function pack(User $user): array
    {
        $tenantId = $user->tenant_id;
        $today = Carbon::today()->toDateString();

        $register = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->with(['requester:id,name,department_id', 'requester.department:id,name', 'programme:id,title,reference_number'])
            ->orderByDesc('departure_date')
            ->limit(500)
            ->get();

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

        $cancellations = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('status', 'cancelled')->orWhereNotNull('cancelled_at');
            })
            ->orderByDesc('cancelled_at')
            ->limit(200)
            ->get(['id', 'reference_number', 'requester_id', 'status', 'cancelled_at', 'cancellation_reason', 'destination_country']);

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

        $byDepartment = TravelRequest::query()
            ->where('travel_requests.tenant_id', $tenantId)
            ->join('users', 'users.id', '=', 'travel_requests.requester_id')
            ->leftJoin('departments', 'departments.id', '=', 'users.department_id')
            ->select(
                'users.department_id',
                DB::raw('coalesce(departments.name, \'Unassigned\') as department'),
                DB::raw('count(*) as travel_count'),
                DB::raw('coalesce(sum(coalesce(travel_requests.finance_dsa_total, travel_requests.estimated_dsa, 0)), 0) as cost_total')
            )
            ->groupBy('users.department_id', 'departments.name')
            ->orderByDesc('cost_total')
            ->get();

        $byProgramme = TravelRequest::query()
            ->where('travel_requests.tenant_id', $tenantId)
            ->leftJoin('programmes', 'programmes.id', '=', 'travel_requests.programme_id')
            ->select(
                'travel_requests.programme_id',
                DB::raw('coalesce(programmes.reference_number, programmes.title, \'Unassigned\') as programme'),
                DB::raw('count(*) as travel_count'),
                DB::raw('coalesce(sum(coalesce(travel_requests.finance_dsa_total, travel_requests.estimated_dsa, 0)), 0) as cost_total')
            )
            ->groupBy('travel_requests.programme_id', 'programmes.reference_number', 'programmes.title')
            ->orderByDesc('cost_total')
            ->get();

        $byDonor = DB::table('travel_funding_lines')
            ->join('travel_requests', 'travel_requests.id', '=', 'travel_funding_lines.travel_request_id')
            ->where('travel_requests.tenant_id', $tenantId)
            ->where(function ($q) {
                $q->where('travel_funding_lines.payor_donor', true)
                    ->orWhereNotNull('travel_funding_lines.funding_agency')
                    ->orWhere('travel_funding_lines.donor_amount', '>', 0);
            })
            ->select(
                DB::raw('coalesce(nullif(travel_funding_lines.funding_agency, \'\'), \'Donor\') as donor'),
                DB::raw('count(distinct travel_requests.id) as travel_count'),
                DB::raw('coalesce(sum(coalesce(travel_funding_lines.donor_amount, travel_funding_lines.forum_amount, 0)), 0) as amount_total')
            )
            ->groupBy(DB::raw('coalesce(nullif(travel_funding_lines.funding_agency, \'\'), \'Donor\')'))
            ->orderByDesc('amount_total')
            ->get();

        $dsaSummary = TravelRequest::query()
            ->where('tenant_id', $tenantId)
            ->whereNotNull('finance_dsa_total')
            ->orderByDesc('approved_at')
            ->limit(500)
            ->get(['id', 'reference_number', 'requester_id', 'destination_country', 'finance_dsa_total', 'meal_deduction_total', 'currency', 'finance_status']);

        return [
            'travel_register' => $register,
            'upcoming_travel' => $upcoming,
            'current_travellers' => $current,
            'by_department' => $byDepartment,
            'by_programme' => $byProgramme,
            'by_donor' => $byDonor,
            'dsa_summary' => $dsaSummary,
            'cancellations' => $cancellations,
            'outstanding_retirement' => $outstandingRetirement,
            'toil_candidates' => $toil,
            'visa_status' => $visa,
            'amendments' => $amendments,
            'cost_by_destination' => $byDestination,
            'cost_by_traveller' => $byTraveller,
        ];
    }

    public function exportCsv(User $user, string $slice): StreamedResponse
    {
        $pack = $this->pack($user);
        if (! array_key_exists($slice, $pack)) {
            abort(404, 'Unknown report slice.');
        }

        $rows = collect($pack[$slice])->map(function ($row) {
            return is_array($row) ? $row : (method_exists($row, 'toArray') ? $row->toArray() : (array) $row);
        })->values();

        $filename = 'travel-'.$slice.'-'.now()->format('Ymd-His').'.csv';

        return response()->streamDownload(function () use ($rows) {
            $out = fopen('php://output', 'w');
            if ($rows->isEmpty()) {
                fputcsv($out, ['empty']);
                fclose($out);

                return;
            }
            $headers = array_keys($rows->first());
            fputcsv($out, $headers);
            foreach ($rows as $row) {
                $line = [];
                foreach ($headers as $h) {
                    $val = $row[$h] ?? '';
                    if (is_array($val) || is_object($val)) {
                        $val = json_encode($val);
                    }
                    $line[] = $val;
                }
                fputcsv($out, $line);
            }
            fclose($out);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
        ]);
    }
}
