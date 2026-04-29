<?php

namespace App\Modules\Timesheets\Services;

use App\Models\AuditLog;
use App\Models\HolidayCalendar;
use App\Models\Timesheet;
use App\Models\TravelRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Carbon\Carbon;
use Illuminate\Validation\ValidationException;

class TimesheetService
{
    public function __construct(
        protected WorkflowService     $workflowService,
        protected NotificationService $notificationService,
    ) {}

    /**
     * Submit a draft timesheet for approval, initiating the workflow.
     */
    public function submit(Timesheet $timesheet, User $user): Timesheet
    {
        if (!$timesheet->isDraft()) {
            throw ValidationException::withMessages(['status' => 'Only draft timesheets can be submitted.']);
        }

        $timesheet->update(['status' => 'submitted', 'submitted_at' => now()]);

        // Initiate workflow (if a workflow is configured for this tenant)
        $this->workflowService->initiate($timesheet, 'timesheet', $user);

        // Notify HR approvers
        $approvers = User::role(['HR Manager', 'HR Administrator', 'Secretary General'])
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->get();

        $this->notificationService->dispatchToMany($approvers, 'timesheet.submitted', [
            'requester'  => $user->name,
            'week_start' => $timesheet->week_start->format('d M Y'),
            'week_end'   => $timesheet->week_end->format('d M Y'),
            'hours'      => $timesheet->total_hours,
        ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/' . $timesheet->id]);

        AuditLog::record('timesheet.submitted', [
            'auditable_type' => Timesheet::class,
            'auditable_id'   => $timesheet->id,
            'tags'           => 'timesheet',
        ]);

        return $timesheet->fresh();
    }

    /**
     * Called by Timesheet model when the workflow engine approves.
     */
    public function onWorkflowApproved(Timesheet $timesheet, User $approver): void
    {
        $timesheet->loadMissing('user');

        if ($timesheet->user) {
            $this->notificationService->dispatch($timesheet->user, 'timesheet.approved', [
                'name'       => $timesheet->user->name,
                'week_start' => $timesheet->week_start->format('d M Y'),
                'week_end'   => $timesheet->week_end->format('d M Y'),
                'approved_by'=> $approver->name,
            ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/' . $timesheet->id]);
        }

        AuditLog::record('timesheet.approved', [
            'auditable_type' => Timesheet::class,
            'auditable_id'   => $timesheet->id,
            'tags'           => 'timesheet',
        ]);
    }

    /**
     * Called by Timesheet model when the workflow engine rejects.
     */
    public function onWorkflowRejected(Timesheet $timesheet, User $approver, ?string $reason = null): void
    {
        $timesheet->loadMissing('user');

        if ($timesheet->user) {
            $this->notificationService->dispatch($timesheet->user, 'timesheet.rejected', [
                'name'       => $timesheet->user->name,
                'week_start' => $timesheet->week_start->format('d M Y'),
                'week_end'   => $timesheet->week_end->format('d M Y'),
                'comment'    => $reason ?? '',
            ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/' . $timesheet->id]);
        }

        AuditLog::record('timesheet.rejected', [
            'auditable_type' => Timesheet::class,
            'auditable_id'   => $timesheet->id,
            'tags'           => 'timesheet',
        ]);
    }

    /**
     * Get travel-blocked days for a user in the given date range.
     * Returns: ['Y-m-d' => ['purpose' => ..., 'destination' => ..., 'reference' => ...]]
     */
    public function getTravelDays(User $user, string $weekStart, string $weekEnd): array
    {
        $start = Carbon::parse($weekStart);
        $end   = Carbon::parse($weekEnd);

        $missions = TravelRequest::where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted'])
            ->where('departure_date', '<=', $end->format('Y-m-d'))
            ->where('return_date', '>=', $start->format('Y-m-d'))
            ->get(['purpose', 'destination_country', 'destination_city', 'reference_number', 'departure_date', 'return_date']);

        $map = [];
        foreach ($missions as $mission) {
            $current = Carbon::parse($mission->departure_date);
            $mEnd    = Carbon::parse($mission->return_date);
            while ($current->lte($mEnd)) {
                if ($current->between($start, $end)) {
                    $map[$current->format('Y-m-d')] = [
                        'purpose'     => $mission->purpose,
                        'destination' => trim(($mission->destination_city ? $mission->destination_city . ', ' : '') . $mission->destination_country),
                        'reference'   => $mission->reference_number,
                    ];
                }
                $current->addDay();
            }
        }

        return $map;
    }

    /**
     * Get public holidays in the given date range for the user's tenant.
     * Returns: ['Y-m-d' => ['name' => ..., 'is_paid' => bool]]
     */
    public function getHolidayDates(User $user, string $start, string $end): array
    {
        $calendar = HolidayCalendar::where('tenant_id', $user->tenant_id)
            ->where('is_default', true)
            ->first();

        if (!$calendar) {
            return [];
        }

        $dates = $calendar->dates()
            ->whereBetween('date', [$start, $end])
            ->get(['holiday_name', 'date', 'is_paid_holiday']);

        $map = [];
        foreach ($dates as $d) {
            $map[$d->date->format('Y-m-d')] = [
                'name'    => $d->holiday_name,
                'is_paid' => $d->is_paid_holiday,
            ];
        }

        return $map;
    }
}
