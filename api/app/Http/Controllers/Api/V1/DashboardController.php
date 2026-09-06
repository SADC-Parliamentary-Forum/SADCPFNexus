<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Assignment;
use App\Models\Correspondence;
use App\Models\ImprestRequest;
use App\Models\LeaveRequest;
use App\Models\ProcurementRequest;
use App\Models\Risk;
use App\Models\SalaryAdvanceRequest;
use App\Models\StockRequest;
use App\Models\Timesheet;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\AccessControl\Services\AccessScopeResolver;
use App\Modules\AccessControl\Services\PolicyDecisionPoint;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Dashboard stats from API data (no hardcoded values).
     * Counts are filtered by effective permissions and AccessScopeResolver so
     * badge numbers cannot leak records the actor cannot list.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        $tenantId = $user->tenant_id;
        $pdp = app(PolicyDecisionPoint::class);
        $scopes = app(AccessScopeResolver::class);

        $pendingTravel = 0;
        if ($this->canSeeModule($pdp, $user, ['travel.view', 'travel.approve', 'travel.admin', 'travel.create'])) {
            $q = TravelRequest::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'travel']);
            $pendingTravel = $q->count();
        }

        $pendingLeave = 0;
        if ($this->canSeeModule($pdp, $user, ['leave.view', 'leave.approve', 'leave.admin', 'leave.create'])) {
            $q = LeaveRequest::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'leave']);
            $pendingLeave = $q->count();
        }

        $pendingImprest = 0;
        if ($this->canSeeModule($pdp, $user, ['imprest.view', 'imprest.approve', 'imprest.admin', 'imprest.create', 'finance.view'])) {
            $q = ImprestRequest::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'imprest']);
            $pendingImprest = $q->count();
        }

        $pendingProcurement = 0;
        if ($this->canSeeModule($pdp, $user, ['procurement.view', 'procurement.approve', 'procurement.admin', 'procurement.create'])) {
            $q = ProcurementRequest::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'procurement']);
            $pendingProcurement = $q->count();
        }

        $pendingApprovals = $pendingTravel + $pendingLeave + $pendingImprest + $pendingProcurement;

        $activeTravels = 0;
        if ($this->canSeeModule($pdp, $user, ['travel.view', 'travel.approve', 'travel.admin', 'travel.create'])) {
            $q = TravelRequest::where('tenant_id', $tenantId)->whereIn('status', ['submitted', 'approved']);
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'travel']);
            $activeTravels = $q->count();
        }

        $leaveRequests = 0;
        if ($this->canSeeModule($pdp, $user, ['leave.view', 'leave.approve', 'leave.admin', 'leave.create'])) {
            $q = LeaveRequest::where('tenant_id', $tenantId);
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'leave']);
            $leaveRequests = $q->count();
        }

        $openRequisitions = 0;
        if ($this->canSeeModule($pdp, $user, ['procurement.view', 'procurement.approve', 'procurement.admin', 'procurement.create'])) {
            $q = ProcurementRequest::where('tenant_id', $tenantId)->whereIn('status', ['draft', 'submitted']);
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'procurement']);
            $openRequisitions = $q->count();
        }

        $openCorrespondence = 0;
        if ($this->canSeeModule($pdp, $user, ['correspondence.view', 'correspondence.registry', 'correspondence.create'])) {
            $q = Correspondence::where('tenant_id', $tenantId)->whereNotIn('status', ['archived', 'closed']);
            $scopes->constrainQuery($q, $user, 'created_by', ['module' => 'correspondence']);
            $openCorrespondence = $q->count();
        }

        $openRisks = 0;
        if ($this->canSeeModule($pdp, $user, ['risk.view', 'risk.manage', 'risk.create'])) {
            $q = Risk::where('tenant_id', $tenantId)->whereNotIn('status', ['closed', 'archived']);
            $scopes->constrainQuery($q, $user, 'submitted_by', ['module' => 'risk']);
            $openRisks = $q->count();
        }

        $pendingSalaryAdvances = 0;
        if ($this->canSeeModule($pdp, $user, ['salary_advance.view', 'salary_advance.create', 'salary_advance.certify', 'finance.view'])) {
            $q = SalaryAdvanceRequest::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'requester_id', ['module' => 'salary_advance']);
            $pendingSalaryAdvances = $q->count();
        }

        $openAssignments = 0;
        if ($this->canSeeModule($pdp, $user, ['assignments.view', 'assignments.create', 'assignment.read.assigned', 'assignment.module.view'])) {
            $q = Assignment::where('tenant_id', $tenantId)
                ->where('is_template', false)
                ->whereNotIn('status', ['closed', 'cancelled', 'completed']);
            $scopes->constrainQuery($q, $user, 'created_by', [
                'module' => 'assignments',
                'owner_columns' => ['created_by', 'assigned_to', 'reviewer_id'],
                'participant_relation' => 'participants',
            ]);
            $openAssignments = $q->count();
        }

        $pendingTimesheets = 0;
        if ($this->canSeeModule($pdp, $user, ['timesheets.view', 'timesheets.view-own', 'timesheets.create', 'timesheet.module.view', 'hr.view'])) {
            $q = Timesheet::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'user_id', ['module' => 'timesheets']);
            $pendingTimesheets = $q->count();
        }

        $pendingStockRequests = 0;
        if ($this->canSeeModule($pdp, $user, ['stock.view', 'stock.create', 'stock.approve'])) {
            $q = StockRequest::where('tenant_id', $tenantId)->where('status', 'submitted');
            $scopes->constrainQuery($q, $user, 'requested_by', ['module' => 'stock']);
            $pendingStockRequests = $q->count();
        }

        $pendingApprovals += $pendingSalaryAdvances;

        return response()->json([
            'app_name' => config('app.name'),
            'pending_approvals' => $pendingApprovals,
            'active_travels' => $activeTravels,
            'leave_requests' => $leaveRequests,
            'open_requisitions' => $openRequisitions,
            'open_correspondence' => $openCorrespondence,
            'open_risks' => $openRisks,
            'pending_salary_advances' => $pendingSalaryAdvances,
            'open_assignments' => $openAssignments,
            'pending_timesheets' => $pendingTimesheets,
            'pending_stock_requests' => $pendingStockRequests,
            'breakdown' => [
                'pending_travel' => $pendingTravel,
                'pending_leave' => $pendingLeave,
                'pending_imprest' => $pendingImprest,
                'pending_procurement' => $pendingProcurement,
                'pending_salary_advances' => $pendingSalaryAdvances,
                'open_correspondence' => $openCorrespondence,
                'open_risks' => $openRisks,
                'open_assignments' => $openAssignments,
                'pending_timesheets' => $pendingTimesheets,
                'pending_stock_requests' => $pendingStockRequests,
            ],
        ]);
    }

    /**
     * @param  list<string>  $anyOf
     */
    private function canSeeModule(PolicyDecisionPoint $pdp, User $user, array $anyOf): bool
    {
        if ($user->isSystemAdmin() || $user->hasAnyRole(['System Admin', 'super-admin'])) {
            return true;
        }

        foreach ($anyOf as $perm) {
            if ($pdp->can($user, $perm) || $user->can($perm)) {
                return true;
            }
        }

        return false;
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
                        'id' => 'birthday-'.$user->id.'-'.$dateStr,
                        'date' => $dateStr,
                        'title' => $user->name."'s birthday",
                        'type' => 'birthday',
                    ];
                }
            }
        }

        usort($items, fn ($a, $b) => strcmp($a['date'], $b['date']));

        return response()->json(['data' => $items]);
    }
}
