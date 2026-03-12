<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Asset;
use App\Models\LeaveRequest;
use App\Models\TravelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ReportsController extends Controller
{
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
     * List assets for reporting. Query: category, period_from, period_to (on created_at), per_page.
     */
    public function assets(Request $request): JsonResponse
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

        $perPage = min((int) $request->input('per_page', 100), 100);
        $paginator = $query->paginate($perPage);

        return response()->json($paginator);
    }

    /**
     * List travel requests for reporting. Query: period_from, period_to (Y-m-d), per_page.
     */
    public function travel(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);

        return response()->json($paginator);
    }

    /**
     * List leave requests for reporting. Query: period_from, period_to (Y-m-d), per_page.
     */
    public function leave(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = LeaveRequest::where('tenant_id', $user->tenant_id)->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);

        return response()->json($paginator);
    }

    /**
     * DSA / travel allowances report. Returns travel requests with DSA-related summary (e.g. trip dates, destinations).
     * Query: period_from, period_to, per_page.
     */
    public function dsa(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = TravelRequest::where('tenant_id', $user->tenant_id)->orderByDesc('created_at');

        if ($from = $request->input('period_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('period_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $perPage = min((int) $request->input('per_page', 50), 100);
        $paginator = $query->paginate($perPage);

        return response()->json($paginator);
    }
}
