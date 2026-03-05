<?php
namespace App\Modules\Alerts\Services;

use App\Models\User;
use App\Models\WorkplanEvent;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

class AlertsService
{
    public function getSummary(User $user): array
    {
        $today = Carbon::today();
        $tenantId = $user->tenant_id;

        // 1. Away today (approved leave + approved travel)
        $awayLeave = DB::table('leave_requests')
            ->join('users', 'users.id', '=', 'leave_requests.requester_id')
            ->where('leave_requests.tenant_id', $tenantId)
            ->where('leave_requests.status', 'approved')
            ->whereDate('leave_requests.start_date', '<=', $today)
            ->whereDate('leave_requests.end_date', '>=', $today)
            ->select('users.id', 'users.name', DB::raw("'leave' as type"), 'leave_requests.start_date as from_date', 'leave_requests.end_date as to_date')
            ->get();

        $awayTravel = DB::table('travel_requests')
            ->join('users', 'users.id', '=', 'travel_requests.requester_id')
            ->where('travel_requests.tenant_id', $tenantId)
            ->where('travel_requests.status', 'approved')
            ->whereDate('travel_requests.departure_date', '<=', $today)
            ->whereDate('travel_requests.return_date', '>=', $today)
            ->select('users.id', 'users.name', DB::raw("'travel' as type"), 'travel_requests.departure_date as from_date', 'travel_requests.return_date as to_date')
            ->get();

        $awayToday = $awayLeave->merge($awayTravel)->values();

        // 2. Active missions (travel currently ongoing)
        $activeMissions = DB::table('travel_requests')
            ->join('users', 'users.id', '=', 'travel_requests.requester_id')
            ->where('travel_requests.tenant_id', $tenantId)
            ->where('travel_requests.status', 'approved')
            ->whereDate('travel_requests.departure_date', '<=', $today)
            ->whereDate('travel_requests.return_date', '>=', $today)
            ->select(
                'travel_requests.id',
                'travel_requests.reference_number',
                'travel_requests.purpose',
                'travel_requests.destination_country',
                'travel_requests.departure_date',
                'travel_requests.return_date',
                'users.name as requester_name'
            )
            ->get();

        // 3. Upcoming deadlines (next 14 days)
        $deadline = $today->copy()->addDays(14);

        $imprestDeadlines = DB::table('imprest_requests')
            ->join('users', 'users.id', '=', 'imprest_requests.requester_id')
            ->where('imprest_requests.tenant_id', $tenantId)
            ->where('imprest_requests.status', 'approved')
            ->whereNotNull('imprest_requests.expected_liquidation_date')
            ->whereDate('imprest_requests.expected_liquidation_date', '>=', $today)
            ->whereDate('imprest_requests.expected_liquidation_date', '<=', $deadline)
            ->select(
                'imprest_requests.id',
                'imprest_requests.reference_number',
                DB::raw("'imprest' as module"),
                DB::raw("CONCAT('Imprest Retirement: ', imprest_requests.reference_number) as title"),
                'imprest_requests.expected_liquidation_date as deadline_date',
                'users.name as responsible'
            )
            ->get();

        $workplanDeadlines = WorkplanEvent::where('tenant_id', $tenantId)
            ->where('type', 'deadline')
            ->whereDate('date', '>=', $today)
            ->whereDate('date', '<=', $deadline)
            ->get(['id', 'title', DB::raw("'workplan' as module"), 'date as deadline_date', 'responsible']);

        $upcomingDeadlines = collect($imprestDeadlines)
            ->merge($workplanDeadlines)
            ->sortBy('deadline_date')
            ->values();

        // 4. Events this week (Mon–Sun)
        $monday = $today->copy()->startOfWeek();
        $sunday = $today->copy()->endOfWeek();

        $eventsThisWeek = WorkplanEvent::where('tenant_id', $tenantId)
            ->whereDate('date', '>=', $monday)
            ->whereDate('date', '<=', $sunday)
            ->orderBy('date')
            ->get(['id', 'title', 'type', 'date', 'responsible', 'description']);

        return [
            'away_today'         => $awayToday,
            'active_missions'    => $activeMissions,
            'upcoming_deadlines' => $upcomingDeadlines,
            'events_this_week'   => $eventsThisWeek,
        ];
    }
}
