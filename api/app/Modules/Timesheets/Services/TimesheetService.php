<?php

namespace App\Modules\Timesheets\Services;

use App\Models\AuditLog;
use App\Models\EmployeeScheduleAssignment;
use App\Models\EmployeeWorkSchedule;
use App\Models\HolidayCalendar;
use App\Models\LeaveRequest;
use App\Models\Timesheet;
use App\Models\TimesheetAuditEvent;
use App\Models\TimesheetDay;
use App\Models\TimesheetEntry;
use App\Models\TimesheetPeriod;
use App\Models\TravelRequest;
use App\Models\User;
use App\Services\NotificationService;
use App\Services\WorkflowService;
use Carbon\Carbon;
use Carbon\CarbonPeriod;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TimesheetService
{
    public function __construct(
        protected WorkflowService $workflowService,
        protected NotificationService $notificationService,
    ) {}

    /**
     * Default Mon–Fri 08:00–17:00, lunch 13:00–14:00, 8 ordinary hours (configurable per tenant).
     */
    public function ensureDefaultSchedule(int $tenantId): EmployeeWorkSchedule
    {
        $existing = EmployeeWorkSchedule::where('tenant_id', $tenantId)
            ->where('is_default', true)
            ->where('is_active', true)
            ->first();

        if ($existing) {
            return $existing;
        }

        return EmployeeWorkSchedule::create([
            'tenant_id' => $tenantId,
            'name' => 'Standard Office Hours',
            'code' => 'STD-MF',
            'is_default' => true,
            'working_days' => [1, 2, 3, 4, 5],
            'start_time' => '08:00:00',
            'end_time' => '17:00:00',
            'lunch_start' => '13:00:00',
            'lunch_end' => '14:00:00',
            'ordinary_hours_per_day' => 8,
            'is_active' => true,
        ]);
    }

    public function resolveScheduleForUser(User $user, Carbon $onDate): EmployeeWorkSchedule
    {
        $assignment = EmployeeScheduleAssignment::with('schedule')
            ->where('user_id', $user->id)
            ->where('effective_from', '<=', $onDate->toDateString())
            ->where(function ($q) use ($onDate) {
                $q->whereNull('effective_to')
                    ->orWhere('effective_to', '>=', $onDate->toDateString());
            })
            ->orderByDesc('effective_from')
            ->first();

        if ($assignment?->schedule) {
            return $assignment->schedule;
        }

        return $this->ensureDefaultSchedule((int) $user->tenant_id);
    }

    /**
     * Expected ordinary hours for a date range using the employee's schedule + holidays.
     *
     * @return array{expected_hours: float, days: array<string, array{expected: float, status: string}>}
     */
    public function calculateExpectedHours(User $user, string $start, string $end): array
    {
        $periodStart = Carbon::parse($start)->startOfDay();
        $periodEnd = Carbon::parse($end)->startOfDay();
        $holidays = $this->getHolidayDates($user, $start, $end);
        $days = [];
        $total = 0.0;

        foreach (CarbonPeriod::create($periodStart, $periodEnd) as $day) {
            /** @var Carbon $day */
            $key = $day->format('Y-m-d');
            $schedule = $this->resolveScheduleForUser($user, $day);
            $iso = (int) $day->dayOfWeekIso; // 1=Mon … 7=Sun
            $workingDays = $schedule->working_days ?? [1, 2, 3, 4, 5];

            if (isset($holidays[$key])) {
                $days[$key] = ['expected' => 0.0, 'status' => 'holiday'];
                continue;
            }

            if (! in_array($iso, $workingDays, true)) {
                $days[$key] = ['expected' => 0.0, 'status' => 'weekend'];
                continue;
            }

            $hours = (float) $schedule->ordinary_hours_per_day;
            $days[$key] = ['expected' => $hours, 'status' => 'working'];
            $total += $hours;
        }

        return ['expected_hours' => round($total, 2), 'days' => $days];
    }

    /**
     * Approved leave days keyed by Y-m-d (authoritative Leave module).
     *
     * @return array<string, array{leave_type: string, status: string, leave_request_id: int}>
     */
    public function getLeaveDays(User $user, string $weekStart, string $weekEnd): array
    {
        $start = Carbon::parse($weekStart);
        $end = Carbon::parse($weekEnd);

        $leaves = LeaveRequest::where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted'])
            ->where('start_date', '<=', $end->format('Y-m-d'))
            ->where('end_date', '>=', $start->format('Y-m-d'))
            ->get(['id', 'leave_type', 'status', 'start_date', 'end_date']);

        $map = [];
        foreach ($leaves as $leave) {
            $current = Carbon::parse($leave->start_date);
            $leaveEnd = Carbon::parse($leave->end_date);
            while ($current->lte($leaveEnd)) {
                if ($current->between($start, $end)) {
                    $map[$current->format('Y-m-d')] = [
                        'leave_type' => $leave->leave_type,
                        'status' => $leave->status,
                        'leave_request_id' => (int) $leave->id,
                    ];
                }
                $current->addDay();
            }
        }

        return $map;
    }

    public function getTravelDays(User $user, string $weekStart, string $weekEnd): array
    {
        $start = Carbon::parse($weekStart);
        $end = Carbon::parse($weekEnd);

        $missions = TravelRequest::where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted'])
            ->where('departure_date', '<=', $end->format('Y-m-d'))
            ->where('return_date', '>=', $start->format('Y-m-d'))
            ->get(['id', 'purpose', 'destination_country', 'destination_city', 'reference_number', 'departure_date', 'return_date']);

        $map = [];
        foreach ($missions as $mission) {
            $current = Carbon::parse($mission->departure_date);
            $mEnd = Carbon::parse($mission->return_date);
            while ($current->lte($mEnd)) {
                if ($current->between($start, $end)) {
                    $map[$current->format('Y-m-d')] = [
                        'purpose' => $mission->purpose,
                        'destination' => trim(($mission->destination_city ? $mission->destination_city.', ' : '').$mission->destination_country),
                        'reference' => $mission->reference_number,
                        'travel_request_id' => (int) $mission->id,
                    ];
                }
                $current->addDay();
            }
        }

        return $map;
    }

    public function getHolidayDates(User $user, string $start, string $end): array
    {
        $calendar = HolidayCalendar::where('tenant_id', $user->tenant_id)
            ->where('is_default', true)
            ->first();

        if (! $calendar) {
            return [];
        }

        $dates = $calendar->dates()
            ->whereBetween('date', [$start, $end])
            ->get(['holiday_name', 'date', 'is_paid_holiday']);

        $map = [];
        foreach ($dates as $d) {
            $map[$d->date->format('Y-m-d')] = [
                'name' => $d->holiday_name,
                'is_paid' => $d->is_paid_holiday,
            ];
        }

        return $map;
    }

    /**
     * Validate entry payload: leave blocks ordinary work; overlaps blocked; daily limits.
     *
     * @param  array<int, array<string, mixed>>  $entries
     */
    public function validateEntries(User $user, string $weekStart, string $weekEnd, array $entries): void
    {
        $leaveDays = $this->getLeaveDays($user, $weekStart, $weekEnd);
        $byDate = [];

        foreach ($entries as $idx => $e) {
            $date = Carbon::parse($e['work_date'])->format('Y-m-d');
            $hours = (float) ($e['hours'] ?? 0);
            $ot = (float) ($e['overtime_hours'] ?? 0);
            $source = $e['source_type'] ?? 'manual';
            $start = $e['start_time'] ?? null;
            $end = $e['end_time'] ?? null;

            if ($hours < 0 || $hours > 24 || $ot < 0 || $ot > 12) {
                throw ValidationException::withMessages([
                    "entries.{$idx}.hours" => 'Hours must be 0–24 and overtime 0–12.',
                ]);
            }

            // Leave days: ordinary manual work is blocked; leave-sourced locked rows allowed.
            if (isset($leaveDays[$date]) && $source === 'manual' && $hours > 0) {
                throw ValidationException::withMessages([
                    "entries.{$idx}.work_date" => "Ordinary work cannot be recorded on leave day {$date}. Leave is linked from the Leave module.",
                ]);
            }

            $byDate[$date][] = [
                'idx' => $idx,
                'start' => $start,
                'end' => $end,
                'hours' => $hours,
                'ot' => $ot,
            ];
        }

        foreach ($byDate as $date => $dayEntries) {
            $dayTotal = array_sum(array_column($dayEntries, 'hours'))
                + array_sum(array_column($dayEntries, 'ot'));
            if ($dayTotal > 24) {
                throw ValidationException::withMessages([
                    'entries' => "Total hours on {$date} exceed 24.",
                ]);
            }

            // Overlap check when both start/end present
            $intervals = [];
            foreach ($dayEntries as $row) {
                if (! $row['start'] || ! $row['end']) {
                    continue;
                }
                $s = Carbon::parse($date.' '.$row['start']);
                $en = Carbon::parse($date.' '.$row['end']);
                if ($en->lte($s)) {
                    throw ValidationException::withMessages([
                        "entries.{$row['idx']}.end_time" => 'End time must be after start time.',
                    ]);
                }
                foreach ($intervals as $other) {
                    if ($s->lt($other['end']) && $en->gt($other['start'])) {
                        throw ValidationException::withMessages([
                            "entries.{$row['idx']}.start_time" => "Overlapping time entries are not allowed on {$date}.",
                        ]);
                    }
                }
                $intervals[] = ['start' => $s, 'end' => $en];
            }
        }
    }

    /**
     * Prefill locked leave/travel/holiday day markers (does not invent worked hours).
     */
    public function syncTimesheetDays(Timesheet $timesheet, User $user): void
    {
        $weekStart = $timesheet->week_start->format('Y-m-d');
        $weekEnd = $timesheet->week_end->format('Y-m-d');
        $expected = $this->calculateExpectedHours($user, $weekStart, $weekEnd);
        $leave = $this->getLeaveDays($user, $weekStart, $weekEnd);
        $travel = $this->getTravelDays($user, $weekStart, $weekEnd);

        foreach ($expected['days'] as $date => $info) {
            $status = $info['status'];
            $expectedHours = $info['expected'];
            $leaveId = null;
            $travelId = null;

            if (isset($leave[$date])) {
                $status = 'leave';
                $expectedHours = 0;
                $leaveId = $leave[$date]['leave_request_id'];
            } elseif (isset($travel[$date]) && $status === 'working') {
                // Travel on a working day is linked, not automatic OT/TOIL
                $status = 'travel';
                $travelId = $travel[$date]['travel_request_id'];
            } elseif (isset($travel[$date])) {
                $travelId = $travel[$date]['travel_request_id'];
            }

            TimesheetDay::updateOrCreate(
                ['timesheet_id' => $timesheet->id, 'work_date' => $date],
                [
                    'expected_hours' => $expectedHours,
                    'day_status' => $status,
                    'leave_request_id' => $leaveId,
                    'travel_request_id' => $travelId,
                ]
            );
        }

        $accounted = (float) $timesheet->entries()->sum('hours');
        $recon = 'balanced';
        if ($accounted + 0.01 < $expected['expected_hours']) {
            $recon = 'under';
        } elseif ($accounted - 0.01 > $expected['expected_hours']) {
            $recon = 'over';
        }

        $timesheet->update([
            'expected_hours' => $expected['expected_hours'],
            'accounted_hours' => $accounted,
            'reconciliation_status' => $recon,
        ]);
    }

    public function ensurePeriod(int $tenantId, string $weekStart, string $weekEnd): TimesheetPeriod
    {
        return TimesheetPeriod::firstOrCreate(
            [
                'tenant_id' => $tenantId,
                'period_start' => $weekStart,
                'period_end' => $weekEnd,
            ],
            [
                'label' => 'Week of '.$weekStart,
                'status' => TimesheetPeriod::OPEN,
            ]
        );
    }

    public function assertPeriodEditable(?TimesheetPeriod $period): void
    {
        if ($period && ! $period->isEditable()) {
            throw ValidationException::withMessages([
                'period' => 'This timesheet period is closed or payroll-exported. Use a controlled correction.',
            ]);
        }
    }

    public function submit(Timesheet $timesheet, User $user, bool $declarationAccepted = true): Timesheet
    {
        if (! $timesheet->isDraft() && $timesheet->status !== 'returned') {
            throw ValidationException::withMessages(['status' => 'Only draft or returned timesheets can be submitted.']);
        }

        if ((int) $timesheet->user_id !== (int) $user->id) {
            throw ValidationException::withMessages(['user' => 'Only the timesheet owner can submit.']);
        }

        if (! $declarationAccepted) {
            throw ValidationException::withMessages(['declaration' => 'Employee declaration must be accepted before submission.']);
        }

        $timesheet->load('entries');
        $this->validateEntries(
            $user,
            $timesheet->week_start->format('Y-m-d'),
            $timesheet->week_end->format('Y-m-d'),
            $timesheet->entries->map(fn ($e) => [
                'work_date' => $e->work_date->format('Y-m-d'),
                'hours' => (float) $e->hours,
                'overtime_hours' => (float) $e->overtime_hours,
                'source_type' => $e->source_type,
                'start_time' => $e->start_time,
                'end_time' => $e->end_time,
            ])->all()
        );

        if ($timesheet->period_id) {
            $this->assertPeriodEditable($timesheet->period);
        }

        $this->syncTimesheetDays($timesheet, $user);

        $timesheet->update([
            'status' => 'submitted',
            'submitted_at' => now(),
            'declaration_accepted_at' => now(),
            'returned_at' => null,
            'return_reason' => null,
            'rejection_reason' => null,
        ]);

        $this->workflowService->initiate($timesheet, 'timesheet', $user);

        $approvers = User::role(['HR Manager', 'HR Administrator', 'Secretary General'])
            ->where('tenant_id', $user->tenant_id)
            ->where('id', '!=', $user->id)
            ->get();

        $this->notificationService->dispatchToMany($approvers, 'timesheet.submitted', [
            'requester' => $user->name,
            'week_start' => $timesheet->week_start->format('d M Y'),
            'week_end' => $timesheet->week_end->format('d M Y'),
            'hours' => $timesheet->total_hours,
        ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/'.$timesheet->id]);

        $this->audit($timesheet, $user, 'timesheet.submitted');

        return $timesheet->fresh();
    }

    public function returnToEmployee(Timesheet $timesheet, User $actor, string $reason): Timesheet
    {
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be returned.']);
        }
        if ((int) $timesheet->user_id === (int) $actor->id) {
            throw ValidationException::withMessages(['approval' => 'You cannot return your own timesheet.']);
        }

        $timesheet->update([
            'status' => 'returned',
            'returned_at' => now(),
            'return_reason' => $reason,
            'version' => ((int) $timesheet->version) + 1,
        ]);

        $timesheet->loadMissing('user');
        if ($timesheet->user) {
            $this->notificationService->dispatch($timesheet->user, 'timesheet.returned', [
                'name' => $timesheet->user->name,
                'reason' => $reason,
            ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/'.$timesheet->id]);
        }

        $this->audit($timesheet, $actor, 'timesheet.returned', null, ['reason' => $reason]);

        return $timesheet->fresh();
    }

    public function approve(Timesheet $timesheet, User $approver, ?string $comment = null): Timesheet
    {
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be approved.']);
        }
        if ((int) $timesheet->user_id === (int) $approver->id) {
            throw ValidationException::withMessages(['approval' => 'You cannot approve your own timesheet.']);
        }

        if ($timesheet->approvalRequest) {
            $this->workflowService->approve($timesheet->approvalRequest, $approver, $comment);
            $timesheet->refresh();
        } else {
            $timesheet->update([
                'status' => 'approved',
                'approved_at' => now(),
                'approved_by' => $approver->id,
            ]);
            $this->onWorkflowApproved($timesheet, $approver);
        }

        return $timesheet->fresh(['user', 'approver']);
    }

    public function onWorkflowApproved(Timesheet $timesheet, User $approver): void
    {
        $timesheet->loadMissing('user');

        if ($timesheet->user) {
            $this->notificationService->dispatch($timesheet->user, 'timesheet.approved', [
                'name' => $timesheet->user->name,
                'week_start' => $timesheet->week_start->format('d M Y'),
                'week_end' => $timesheet->week_end->format('d M Y'),
                'approved_by' => $approver->name,
            ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/'.$timesheet->id]);
        }

        $this->audit($timesheet, $approver, 'timesheet.approved');
    }

    public function onWorkflowRejected(Timesheet $timesheet, User $approver, ?string $reason = null): void
    {
        $timesheet->loadMissing('user');

        if ($timesheet->user) {
            $this->notificationService->dispatch($timesheet->user, 'timesheet.rejected', [
                'name' => $timesheet->user->name,
                'week_start' => $timesheet->week_start->format('d M Y'),
                'week_end' => $timesheet->week_end->format('d M Y'),
                'comment' => $reason ?? '',
            ], ['module' => 'timesheet', 'record_id' => $timesheet->id, 'url' => '/hr/timesheets/'.$timesheet->id]);
        }

        $this->audit($timesheet, $approver, 'timesheet.rejected', null, ['reason' => $reason]);
    }

    /**
     * Weekly Summary integration contract (PRD §76 / §103) — not a performance ranking.
     *
     * @return array<string, mixed>
     */
    /**
     * Suggestion rows for Weekly Summaries (opt-in include only).
     *
     * @return list<array{source_id:int,reference:?string,title:string,status:?string,meta:array}>
     */
    public function weeklySummarySuggestions(User $employee, $period): array
    {
        $start = $period->start_date instanceof Carbon
            ? $period->start_date->copy()->startOfDay()
            : Carbon::parse($period->start_date)->startOfDay();
        $end = $period->end_date instanceof Carbon
            ? $period->end_date->copy()->endOfDay()
            : Carbon::parse($period->end_date)->endOfDay();

        $rows = Timesheet::query()
            ->where('tenant_id', $employee->tenant_id)
            ->where('user_id', $employee->id)
            ->whereDate('week_start', '>=', $start->toDateString())
            ->whereDate('week_start', '<=', $end->toDateString())
            ->orderByDesc('week_start')
            ->get();

        return $rows->map(function (Timesheet $ts) {
            $ref = $ts->week_start?->format('Y-m-d') ?? (string) $ts->id;

            return [
                'source_id' => (int) $ts->id,
                'reference' => $ref,
                'title' => 'Timesheet week of '.$ref.' ('.($ts->status ?? 'unknown').')',
                'status' => $ts->status,
                'meta' => [
                    'expected_hours' => $ts->expected_hours,
                    'accounted_hours' => $ts->accounted_hours,
                    'week_start' => $ts->week_start?->toDateString(),
                ],
            ];
        })->all();
    }

    public function weeklySummaryContract(int $tenantId, Carbon $periodStart, Carbon $periodEnd, ?array $userIds = null): array
    {
        $base = DB::table('timesheets')
            ->where('tenant_id', $tenantId)
            ->whereDate('week_start', '>=', $periodStart->toDateString())
            ->whereDate('week_start', '<=', $periodEnd->toDateString());

        if ($userIds !== null) {
            $base->whereIn('user_id', $userIds);
        }

        $submitted = (clone $base)->whereIn('status', ['submitted', 'approved', 'returned'])->count();
        $approved = (clone $base)->where('status', 'approved')->count();
        $expectedHours = (float) ((clone $base)->sum('expected_hours') ?? 0);
        $accountedHours = (float) ((clone $base)->sum('accounted_hours') ?? 0);

        $otPlanned = (float) DB::table('overtime_requisitions')
            ->where('tenant_id', $tenantId)
            ->whereBetween('work_date', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->whereIn('status', ['submitted', 'recommended', 'approved', 'completed'])
            ->when($userIds !== null, fn ($q) => $q->whereIn('requested_by', $userIds))
            ->sum('planned_hours');

        $otActual = (float) DB::table('overtime_actual_entries')
            ->where('tenant_id', $tenantId)
            ->whereBetween('work_date', [$periodStart->toDateString(), $periodEnd->toDateString()])
            ->when($userIds !== null, fn ($q) => $q->whereIn('user_id', $userIds))
            ->sum('actual_hours');

        $expectedCount = $userIds !== null
            ? count($userIds)
            : (int) DB::table('users')->where('tenant_id', $tenantId)->where('is_active', true)->count();

        return [
            'submitted' => $submitted,
            'approved' => $approved,
            'missing' => max(0, $expectedCount - $submitted),
            'expected' => $expectedCount,
            'expected_hours' => round($expectedHours, 2),
            'accounted_hours' => round($accountedHours, 2),
            'overtime_planned_hours' => round($otPlanned, 2),
            'overtime_actual_hours' => round($otActual, 2),
            'reconciliation' => [
                'note' => 'Hours reconciliation only — not a performance ranking.',
            ],
        ];
    }

    public function audit(
        Timesheet $timesheet,
        ?User $actor,
        string $eventType,
        ?array $old = null,
        ?array $new = null,
        ?string $notes = null,
    ): void {
        TimesheetAuditEvent::create([
            'tenant_id' => $timesheet->tenant_id,
            'timesheet_id' => $timesheet->id,
            'actor_id' => $actor?->id,
            'event_type' => $eventType,
            'old_values' => $old,
            'new_values' => $new,
            'notes' => $notes,
        ]);

        AuditLog::record($eventType, [
            'auditable_type' => Timesheet::class,
            'auditable_id' => $timesheet->id,
            'tags' => 'timesheet',
        ]);
    }
}
