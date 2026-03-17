<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\TravelRequest;
use App\Models\User;
use Carbon\Carbon;
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

    /**
     * Upcoming social events (e.g. staff birthdays) for the next 60 days.
     * Used by the dashboard to show birthdays alongside workplan events.
     */
    public function upcomingSocial(Request $request): JsonResponse
    {
        $tenantId = $request->user()->tenant_id ?? 0;
        $today = Carbon::today();
        $end = $today->copy()->addDays(60);
        $items = [];

        $users = User::where('tenant_id', $tenantId)
            ->whereNotNull('date_of_birth')
            ->select(['id', 'name', 'date_of_birth'])
            ->get();

        foreach ($users as $user) {
            $dob = $user->date_of_birth;
            if (! $dob) {
                continue;
            }
            $birthMonth = (int) $dob->format('m');
            $birthDay = (int) $dob->format('d');
            $thisYear = Carbon::createFromDate($today->year, $birthMonth, $birthDay);
            if ($thisYear->lt($today)) {
                $thisYear->addYear();
            }
            $nextYear = $thisYear->copy()->addYear();
            foreach ([$thisYear, $nextYear] as $candidate) {
                if ($candidate->between($today, $end)) {
                    $dateStr = $candidate->format('Y-m-d');
                    $items[] = [
                        'id'    => 'birthday-' . $user->id . '-' . $dateStr,
                        'date'  => $dateStr,
                        'title' => $user->name . "'s birthday",
                        'type'  => 'birthday',
                    ];
                }
            }
        }

        usort($items, fn ($a, $b) => strcmp($a['date'], $b['date']));

        return response()->json(['data' => $items]);
    }
}
