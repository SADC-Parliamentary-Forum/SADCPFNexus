<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
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

        return response()->json([
            'travel_requests_count' => $travelCount,
            'leave_requests_count' => $leaveCount,
            'report_types' => [
                ['id' => 'travel', 'label' => 'Travel', 'count' => $travelCount],
                ['id' => 'leave', 'label' => 'Leave', 'count' => $leaveCount],
                ['id' => 'dsa', 'label' => 'DSA', 'count' => 0],
                ['id' => 'financial', 'label' => 'Financial', 'count' => 0],
            ],
        ]);
    }
}
