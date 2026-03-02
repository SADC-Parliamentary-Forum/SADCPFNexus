<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\TravelRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Dashboard stats from API data (no hardcoded values).
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;

        $pendingTravel = TravelRequest::where('tenant_id', $tenantId)
            ->where('status', 'submitted')
            ->count();

        $pendingLeave = LeaveRequest::where('tenant_id', $tenantId)
            ->where('status', 'submitted')
            ->count();

        $pendingImprest = ImprestRequest::where('tenant_id', $tenantId)
            ->where('status', 'submitted')
            ->count();

        $pendingProcurement = ProcurementRequest::where('tenant_id', $tenantId)
            ->where('status', 'submitted')
            ->count();

        $pendingApprovals = $pendingTravel + $pendingLeave + $pendingImprest + $pendingProcurement;

        $activeTravels = TravelRequest::where('tenant_id', $tenantId)
            ->whereIn('status', ['submitted', 'approved'])
            ->count();

        $leaveRequests = LeaveRequest::where('tenant_id', $tenantId)->count();

        $openRequisitions = ProcurementRequest::where('tenant_id', $tenantId)
            ->whereIn('status', ['draft', 'submitted'])
            ->count();

        return response()->json([
            'app_name'           => config('app.name'),
            'pending_approvals'  => $pendingApprovals,
            'active_travels'     => $activeTravels,
            'leave_requests'     => $leaveRequests,
            'open_requisitions'  => $openRequisitions,
        ]);
    }
}
