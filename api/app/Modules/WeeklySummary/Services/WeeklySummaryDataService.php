<?php

namespace App\Modules\WeeklySummary\Services;

use App\Models\User;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Collects raw data for each section of the weekly summary.
 * All queries use explicit tenant_id + scope filters (no RLS middleware in job context).
 */
class WeeklySummaryDataService
{
    private int    $tenantId;
    private ?array $userIds;     // null = no filter (institution scope)
    private Carbon $periodStart;
    private Carbon $periodEnd;
    private Carbon $asOf;

    public function __construct(
        int    $tenantId,
        ?array $userIds,
        Carbon $periodStart,
        Carbon $periodEnd,
        Carbon $asOf
    ) {
        $this->tenantId    = $tenantId;
        $this->userIds     = $userIds;
        $this->periodStart = $periodStart;
        $this->periodEnd   = $periodEnd;
        $this->asOf        = $asOf;
    }

    // ─── Who is Out ──────────────────────────────────────────────────────────────

    public function getWhoIsOut(): array
    {
        $leaveQuery = DB::table('leave_requests')
            ->join('users', 'users.id', '=', 'leave_requests.requester_id')
            ->leftJoin('departments', 'departments.id', '=', 'users.department_id')
            ->where('leave_requests.tenant_id', $this->tenantId)
            ->where('leave_requests.status', 'approved')
            ->whereDate('leave_requests.start_date', '<=', $this->asOf)
            ->whereDate('leave_requests.end_date', '>=', $this->asOf)
            ->select(
                'users.id as user_id',
                'users.name',
                DB::raw("COALESCE(departments.name, 'Unknown') as department"),
                DB::raw("CASE WHEN leave_requests.leave_type = 'sick' THEN 'Medical Leave' ELSE leave_requests.leave_type END as status_type"),
                DB::raw("'On Leave' as location"),
                'leave_requests.end_date as return_date'
            );

        $travelQuery = DB::table('travel_requests')
            ->join('users', 'users.id', '=', 'travel_requests.requester_id')
            ->leftJoin('departments', 'departments.id', '=', 'users.department_id')
            ->where('travel_requests.tenant_id', $this->tenantId)
            ->where('travel_requests.status', 'approved')
            ->whereDate('travel_requests.departure_date', '<=', $this->asOf)
            ->whereDate('travel_requests.return_date', '>=', $this->asOf)
            ->select(
                'users.id as user_id',
                'users.name',
                DB::raw("COALESCE(departments.name, 'Unknown') as department"),
                DB::raw("'On Mission' as status_type"),
                DB::raw("COALESCE(travel_requests.destination_city, travel_requests.destination_country, 'Away') as location"),
                'travel_requests.return_date'
            );

        if ($this->userIds !== null) {
            $leaveQuery->whereIn('leave_requests.requester_id', $this->userIds);
            $travelQuery->whereIn('travel_requests.requester_id', $this->userIds);
        }

        $leave  = $leaveQuery->get()->toArray();
        $travel = $travelQuery->get()->toArray();

        // Deduplicate by user_id (leave takes precedence if same person has both)
        $seen = [];
        $out  = [];
        foreach (array_merge($travel, $leave) as $item) {
            if (! isset($seen[$item->user_id])) {
                $seen[$item->user_id] = true;
                $out[] = [
                    'name'        => $item->name,
                    'department'  => $item->department,
                    'status'      => $item->status_type,
                    'location'    => $item->location,
                    'return_date' => $item->return_date,
                ];
            }
        }

        return $out;
    }

    // ─── Travel Summary ───────────────────────────────────────────────────────────

    public function getTravelSummary(): array
    {
        $base = DB::table('travel_requests')
            ->join('users', 'users.id', '=', 'travel_requests.requester_id')
            ->where('travel_requests.tenant_id', $this->tenantId);

        if ($this->userIds !== null) {
            $base->whereIn('travel_requests.requester_id', $this->userIds);
        }

        $ongoing = (clone $base)
            ->where('travel_requests.status', 'approved')
            ->whereDate('travel_requests.departure_date', '<=', $this->asOf)
            ->whereDate('travel_requests.return_date', '>=', $this->asOf)
            ->select('users.name', 'travel_requests.destination_country', 'travel_requests.return_date', 'travel_requests.purpose')
            ->get()->toArray();

        $nextWeekDepartures = (clone $base)
            ->where('travel_requests.status', 'approved')
            ->whereDate('travel_requests.departure_date', '>', $this->asOf)
            ->whereDate('travel_requests.departure_date', '<=', $this->asOf->copy()->addDays(7))
            ->select('users.name', 'travel_requests.destination_country', 'travel_requests.departure_date', 'travel_requests.purpose')
            ->get()->toArray();

        $pendingCount = (clone $base)
            ->where('travel_requests.status', 'submitted')
            ->count();

        $approvedThisWeek = (clone $base)
            ->where('travel_requests.status', 'approved')
            ->whereDate('travel_requests.approved_at', '>=', $this->periodStart)
            ->whereDate('travel_requests.approved_at', '<=', $this->periodEnd)
            ->count();

        return [
            'ongoing'              => array_map(fn ($r) => (array) $r, $ongoing),
            'next_week_departures' => array_map(fn ($r) => (array) $r, $nextWeekDepartures),
            'pending_count'        => $pendingCount,
            'approved_this_week'   => $approvedThisWeek,
        ];
    }

    // ─── Leave Summary ────────────────────────────────────────────────────────────

    public function getLeaveSummary(): array
    {
        $base = DB::table('leave_requests')
            ->where('tenant_id', $this->tenantId)
            ->where(function ($q) {
                $q->whereDate('start_date', '<=', $this->periodEnd)
                  ->whereDate('end_date', '>=', $this->periodStart);
            });

        if ($this->userIds !== null) {
            $base->whereIn('requester_id', $this->userIds);
        }

        $approved  = (clone $base)->where('status', 'approved')->count();
        $submitted = (clone $base)->where('status', 'submitted')->count();
        $rejected  = (clone $base)->where('status', 'rejected')->count();

        return [
            'approved'  => $approved,
            'submitted' => $submitted,
            'rejected'  => $rejected,
            'total'     => $approved + $submitted + $rejected,
        ];
    }

    // ─── Timesheet Summary ────────────────────────────────────────────────────────

    public function getTimesheetSummary(): array
    {
        $base = DB::table('timesheets')
            ->where('tenant_id', $this->tenantId)
            ->whereDate('week_start', $this->periodStart);

        if ($this->userIds !== null) {
            $base->whereIn('user_id', $this->userIds);
        }

        $submitted = (clone $base)->whereIn('status', ['submitted', 'approved'])->count();
        $approved  = (clone $base)->where('status', 'approved')->count();

        // Expected count: number of users in scope
        $expected = $this->userIds !== null
            ? count($this->userIds)
            : DB::table('users')->where('tenant_id', $this->tenantId)->where('is_active', true)->count();

        $missing = max(0, $expected - $submitted);

        return [
            'submitted' => $submitted,
            'approved'  => $approved,
            'missing'   => $missing,
            'expected'  => $expected,
        ];
    }

    // ─── Assignments Summary ──────────────────────────────────────────────────────

    public function getAssignmentSummary(): array
    {
        $base = DB::table('assignments')
            ->where('tenant_id', $this->tenantId);

        if ($this->userIds !== null) {
            $base->whereIn('assigned_to', $this->userIds);
        }

        $completedThisWeek = (clone $base)
            ->whereIn('status', ['completed', 'closed'])
            ->whereDate('closed_at', '>=', $this->periodStart)
            ->whereDate('closed_at', '<=', $this->periodEnd)
            ->count();

        $overdue = (clone $base)
            ->whereNotIn('status', ['completed', 'closed', 'cancelled'])
            ->whereDate('due_date', '<', $this->asOf)
            ->count();

        $dueNextWeek = (clone $base)
            ->whereNotIn('status', ['completed', 'closed', 'cancelled'])
            ->whereDate('due_date', '>', $this->asOf)
            ->whereDate('due_date', '<=', $this->asOf->copy()->addDays(7))
            ->count();

        return [
            'completed_this_week' => $completedThisWeek,
            'overdue'             => $overdue,
            'due_next_week'       => $dueNextWeek,
        ];
    }

    // ─── Approvals Summary ────────────────────────────────────────────────────────

    public function getApprovalsSummary(User $user): array
    {
        $pending = DB::table('approval_requests')
            ->where('tenant_id', $this->tenantId)
            ->where('current_approver_id', $user->id)
            ->where('status', 'pending')
            ->count();

        $overdue = DB::table('approval_requests')
            ->where('tenant_id', $this->tenantId)
            ->where('current_approver_id', $user->id)
            ->where('status', 'pending')
            ->where('created_at', '<', now()->subDays(2))
            ->count();

        return [
            'pending_with_me' => $pending,
            'overdue'         => $overdue,
        ];
    }

    // ─── Personal Summary ─────────────────────────────────────────────────────────

    public function getPersonalSummary(User $user): array
    {
        $myLeave = DB::table('leave_requests')
            ->where('tenant_id', $this->tenantId)
            ->where('requester_id', $user->id)
            ->where(function ($q) {
                $q->whereDate('start_date', '<=', $this->periodEnd)
                  ->whereDate('end_date', '>=', $this->periodStart);
            })
            ->select('reference_number', 'leave_type', 'start_date', 'end_date', 'status')
            ->orderByDesc('start_date')
            ->limit(5)
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        $myTravel = DB::table('travel_requests')
            ->where('tenant_id', $this->tenantId)
            ->where('requester_id', $user->id)
            ->where(function ($q) {
                $q->whereDate('departure_date', '<=', $this->periodEnd)
                  ->whereDate('return_date', '>=', $this->periodStart);
            })
            ->select('reference_number', 'purpose', 'destination_country', 'departure_date', 'return_date', 'status')
            ->orderByDesc('departure_date')
            ->limit(5)
            ->get()
            ->map(fn ($r) => (array) $r)
            ->toArray();

        $myTimesheetSubmitted = DB::table('timesheets')
            ->where('tenant_id', $this->tenantId)
            ->where('user_id', $user->id)
            ->whereDate('week_start', $this->periodStart)
            ->exists();

        $myPendingApprovals = DB::table('approval_requests')
            ->where('tenant_id', $this->tenantId)
            ->where('current_approver_id', $user->id)
            ->where('status', 'pending')
            ->count();

        $myOverdueTasks = DB::table('assignments')
            ->where('tenant_id', $this->tenantId)
            ->where('assigned_to', $user->id)
            ->whereNotIn('status', ['completed', 'closed', 'cancelled'])
            ->whereDate('due_date', '<', $this->asOf)
            ->count();

        return [
            'leave'               => $myLeave,
            'travel'              => $myTravel,
            'timesheet_submitted' => $myTimesheetSubmitted,
            'pending_approvals'   => $myPendingApprovals,
            'overdue_tasks'       => $myOverdueTasks,
        ];
    }

    // ─── Highlights ───────────────────────────────────────────────────────────────

    public function buildHighlights(array $sections): array
    {
        $items = [];

        $outCount = count($sections['who_is_out'] ?? []);
        if ($outCount > 0) {
            $items[] = "{$outCount} staff member" . ($outCount !== 1 ? 's' : '') . " are out this week.";
        }

        $missing = $sections['timesheets']['missing'] ?? 0;
        if ($missing > 0) {
            $items[] = "{$missing} timesheet" . ($missing !== 1 ? 's' : '') . " not yet submitted for this week.";
        }

        $overdueTasks = $sections['assignments']['overdue'] ?? 0;
        if ($overdueTasks > 0) {
            $items[] = "{$overdueTasks} assignment" . ($overdueTasks !== 1 ? 's' : '') . " overdue.";
        }

        $pendingApprovals = $sections['approvals']['pending_with_me'] ?? 0;
        if ($pendingApprovals > 0) {
            $items[] = "{$pendingApprovals} approval" . ($pendingApprovals !== 1 ? 's' : '') . " awaiting your action.";
        }

        $overdueApprovals = $sections['approvals']['overdue'] ?? 0;
        if ($overdueApprovals > 0) {
            $items[] = "{$overdueApprovals} approval" . ($overdueApprovals !== 1 ? 's' : '') . " overdue by more than 2 days.";
        }

        $pendingTravel = $sections['travel']['pending_count'] ?? 0;
        if ($pendingTravel > 0) {
            $items[] = "{$pendingTravel} travel request" . ($pendingTravel !== 1 ? 's' : '') . " pending approval.";
        }

        $dueNext = $sections['assignments']['due_next_week'] ?? 0;
        if ($dueNext > 0) {
            $items[] = "{$dueNext} task" . ($dueNext !== 1 ? 's' : '') . " due next week.";
        }

        if (empty($items)) {
            $items[] = "No urgent items this week. All systems operational.";
        }

        return array_slice($items, 0, 7);
    }
}
