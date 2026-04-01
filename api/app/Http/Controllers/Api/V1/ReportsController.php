<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\LeaveRequest;
use App\Models\TravelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ReportsController extends Controller
{
    /**
     * Stream a CSV download response from a flat array of rows.
     *
     * @param array<array<string,mixed>> $rows
     */
    private function csvResponse(array $rows, string $filename): StreamedResponse
    {
        $headers = !empty($rows) ? array_keys($rows[0]) : [];

        return response()->streamDownload(function () use ($rows, $headers) {
            $out = fopen('php://output', 'w');
            if ($headers) fputcsv($out, $headers);
            foreach ($rows as $row) {
                fputcsv($out, array_values($row));
            }
            fclose($out);
        }, $filename, [
            'Content-Type'        => 'text/csv',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ]);
    }

    /**
     * Summary counts for reports hub (travel, leave, etc.).
     */
    public function summary(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $travelCount = TravelRequest::where('tenant_id', $tenantId)->count();
        $leaveCount = LeaveRequest::where('tenant_id', $tenantId)->count();
        $assetCount = Asset::where('tenant_id', $tenantId)->count();

        return response()->json([
            'travel_requests_count' => $travelCount,
            'leave_requests_count' => $leaveCount,
            'asset_count' => $assetCount,
            'report_types' => [
                ['id' => 'travel', 'label' => 'Travel', 'count' => $travelCount],
                ['id' => 'leave', 'label' => 'Leave', 'count' => $leaveCount],
                ['id' => 'dsa', 'label' => 'DSA', 'count' => 0],
                ['id' => 'financial', 'label' => 'Financial', 'count' => 0],
                ['id' => 'assets', 'label' => 'Assets', 'count' => $assetCount],
            ],
        ]);
    }

    /**
     * List assets for reporting. Query: category, period_from, period_to (on created_at), per_page, format=csv.
     */
    public function assets(Request $request): JsonResponse|StreamedResponse
    {
        $user = $request->user();
        $query = Asset::where('tenant_id', $user->tenant_id)->orderBy('name');

        if ($category = $request->input('category')) {
            $query->where('category', $category);
        }
        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($a) => [
                'asset_tag'        => $a->asset_tag,
                'name'             => $a->name,
                'category'         => $a->category,
                'status'           => $a->status,
                'condition'        => $a->condition,
                'purchase_value'   => $a->purchase_value,
                'current_value'    => $a->current_value,
                'location'         => $a->location,
                'assigned_to'      => $a->assignedUser?->name,
                'created_at'       => $a->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'assets-report-' . now()->format('Ymd') . '.csv');
        }

        $perPage = min((int) $request->input('per_page', 100), 100);
        return response()->json($query->paginate($perPage));
    }

    /**
     * List travel requests for reporting. Query: period_from, period_to (Y-m-d), per_page, format=csv.
     */
    public function travel(Request $request): JsonResponse|StreamedResponse
    {
        $user = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($request->input('format') === 'csv') {
            $rows = $query->get()->map(fn($t) => [
                'reference'   => $t->reference_number,
                'status'      => $t->status,
                'destination' => $t->destination,
                'purpose'     => $t->purpose,
                'departure'   => $t->departure_date,
                'return'      => $t->return_date,
                'created_at'  => $t->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'travel-report-' . now()->format('Ymd') . '.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        return response()->json($query->paginate($perPage));
    }

    /**
     * List leave requests for reporting. Query: period_from, period_to (Y-m-d), per_page, format=csv.
     */
    public function leave(Request $request): JsonResponse|StreamedResponse
    {
        $user = $request->user();
        $query = LeaveRequest::where('tenant_id', $user->tenant_id)->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($request->input('format') === 'csv') {
            $rows = $query->with('user:id,name')->get()->map(fn($l) => [
                'reference'   => $l->reference_number,
                'employee'    => $l->user?->name,
                'leave_type'  => $l->leave_type,
                'status'      => $l->status,
                'start_date'  => $l->start_date,
                'end_date'    => $l->end_date,
                'days'        => $l->days_requested,
                'created_at'  => $l->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'leave-report-' . now()->format('Ymd') . '.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        return response()->json($query->paginate($perPage));
    }

    /**
     * DSA / travel allowances report. Returns travel requests with DSA-related summary.
     * Query: period_from, period_to, per_page, format=csv.
     */
    public function dsa(Request $request): JsonResponse|StreamedResponse
    {
        $user = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        if ($request->input('format') === 'csv') {
            $rows = $query->with('requester:id,name')->get()->map(fn($t) => [
                'reference'       => $t->reference_number,
                'employee'        => $t->requester?->name,
                'destination'     => $t->destination,
                'country'         => $t->destination_country,
                'departure'       => $t->departure_date,
                'return'          => $t->return_date,
                'days'            => $t->number_of_days,
                'dsa_amount'      => $t->dsa_amount,
                'currency'        => $t->currency ?? 'NAD',
                'status'          => $t->status,
                'created_at'      => $t->created_at?->toDateString(),
            ])->toArray();
            return $this->csvResponse($rows, 'dsa-report-' . now()->format('Ymd') . '.csv');
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        return response()->json($query->paginate($perPage));
    }
}
