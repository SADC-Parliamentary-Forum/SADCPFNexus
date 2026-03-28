<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\PerformanceTracker;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TimesheetController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'per_page', 'week_start', 'month', 'year']);
        $query = Timesheet::with(['user', 'entries.project'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('week_start');

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (!empty($filters['week_start'])) {
            $query->where('week_start', $filters['week_start']);
        }

        if (isset($filters['month']) && $filters['month'] !== '' && $filters['month'] !== null) {
            $query->whereMonth('week_start', (int) $filters['month']);
        }
        if (isset($filters['year']) && $filters['year'] !== '' && $filters['year'] !== null) {
            $query->whereYear('week_start', (int) $filters['year']);
        }

        $paginated = $query->paginate($filters['per_page'] ?? 20);
        return response()->json($paginated);
    }

    public function show(Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== request()->user()->id && !$this->canManageTimesheets(request()->user())) {
            abort(403);
        }
        return response()->json($timesheet->load(['entries.project', 'entries.workAssignment', 'user', 'approver']));
    }

    public function store(Request $request): JsonResponse
    {
        // SRHR Researchers have timesheets managed by their host parliament, not SADC-PF
        $hrFile = \App\Models\HrPersonalFile::where('tenant_id', $request->user()->tenant_id)
            ->where('employee_id', $request->user()->id)
            ->first();
        if ($hrFile?->hr_managed_externally) {
            return response()->json(['message' => 'Your daily schedule is managed by your host parliament. Timesheets cannot be submitted through this system.'], 422);
        }

        $data = $request->validate([
            'week_start'                   => ['required', 'date'],
            'week_end'                     => ['required', 'date', 'after_or_equal:week_start'],
            'entries'                      => ['required', 'array', 'min:1'],
            'entries.*.work_date'          => ['required', 'date'],
            'entries.*.hours'              => ['required', 'numeric', 'min:0', 'max:24'],
            'entries.*.overtime_hours'     => ['nullable', 'numeric', 'min:0', 'max:12'],
            'entries.*.description'        => ['nullable', 'string', 'max:500'],
            'entries.*.project_id'         => ['nullable', 'integer', 'exists:timesheet_projects,id'],
            'entries.*.work_bucket'        => ['nullable', 'string', 'in:' . implode(',', TimesheetEntry::WORK_BUCKETS)],
            'entries.*.activity_type'      => ['nullable', 'string', 'max:100'],
            'entries.*.work_assignment_id' => ['nullable', 'integer', 'exists:work_assignments,id'],
        ]);

        $user = $request->user();
        $total = 0;
        $overtime = 0;
        foreach ($data['entries'] as $e) {
            $total += (float) $e['hours'];
            $overtime += (float) ($e['overtime_hours'] ?? 0);
        }

        $timesheet = Timesheet::create([
            'tenant_id'      => $user->tenant_id,
            'user_id'        => $user->id,
            'week_start'     => $data['week_start'],
            'week_end'       => $data['week_end'],
            'total_hours'    => $total,
            'overtime_hours' => $overtime,
            'status'         => 'draft',
        ]);

        foreach ($data['entries'] as $e) {
            TimesheetEntry::create([
                'timesheet_id'       => $timesheet->id,
                'work_date'          => $e['work_date'],
                'hours'              => $e['hours'],
                'overtime_hours'     => $e['overtime_hours'] ?? 0,
                'description'        => $e['description'] ?? null,
                'project_id'         => $e['project_id'] ?? null,
                'work_bucket'        => $e['work_bucket'] ?? null,
                'activity_type'      => $e['activity_type'] ?? null,
                'work_assignment_id' => $e['work_assignment_id'] ?? null,
            ]);
        }

        return response()->json(['message' => 'Timesheet created.', 'data' => $timesheet->load(['entries.project', 'entries.workAssignment', 'user'])], 201);
    }

    public function update(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($timesheet->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft timesheets can be edited.']);
        }

        $data = $request->validate([
            'entries'                      => ['required', 'array', 'min:1'],
            'entries.*.work_date'          => ['required', 'date'],
            'entries.*.hours'              => ['required', 'numeric', 'min:0', 'max:24'],
            'entries.*.overtime_hours'     => ['nullable', 'numeric', 'min:0', 'max:12'],
            'entries.*.description'        => ['nullable', 'string', 'max:500'],
            'entries.*.project_id'         => ['nullable', 'integer', 'exists:timesheet_projects,id'],
            'entries.*.work_bucket'        => ['nullable', 'string', 'in:' . implode(',', TimesheetEntry::WORK_BUCKETS)],
            'entries.*.activity_type'      => ['nullable', 'string', 'max:100'],
            'entries.*.work_assignment_id' => ['nullable', 'integer', 'exists:work_assignments,id'],
        ]);

        $total = 0;
        $overtime = 0;
        foreach ($data['entries'] as $e) {
            $total += (float) $e['hours'];
            $overtime += (float) ($e['overtime_hours'] ?? 0);
        }

        $timesheet->update(['total_hours' => $total, 'overtime_hours' => $overtime]);
        $timesheet->entries()->delete();
        foreach ($data['entries'] as $e) {
            TimesheetEntry::create([
                'timesheet_id'       => $timesheet->id,
                'work_date'          => $e['work_date'],
                'hours'              => $e['hours'],
                'overtime_hours'     => $e['overtime_hours'] ?? 0,
                'description'        => $e['description'] ?? null,
                'project_id'         => $e['project_id'] ?? null,
                'work_bucket'        => $e['work_bucket'] ?? null,
                'activity_type'      => $e['activity_type'] ?? null,
                'work_assignment_id' => $e['work_assignment_id'] ?? null,
            ]);
        }

        return response()->json(['message' => 'Updated.', 'data' => $timesheet->fresh(['entries.project', 'entries.workAssignment', 'user'])]);
    }

    public function submit(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== $request->user()->id) {
            abort(403);
        }
        if ($timesheet->status !== 'draft') {
            throw ValidationException::withMessages(['status' => 'Only draft timesheets can be submitted.']);
        }
        $timesheet->update(['status' => 'submitted', 'submitted_at' => now()]);
        return response()->json(['message' => 'Submitted.', 'data' => $timesheet->fresh('user')]);
    }

    public function approve(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be approved.']);
        }
        if ((int) $timesheet->user_id === (int) $request->user()->id) {
            throw ValidationException::withMessages([
                'approval' => 'You cannot approve your own request.',
            ]);
        }
        $timesheet->update([
            'status'      => 'approved',
            'approved_at' => now(),
            'approved_by' => $request->user()->id,
        ]);
        return response()->json(['message' => 'Approved.', 'data' => $timesheet->fresh(['user', 'approver'])]);
    }

    public function reject(Request $request, Timesheet $timesheet): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be rejected.']);
        }
        $timesheet->update(['status' => 'rejected', 'rejection_reason' => $data['reason']]);
        return response()->json(['message' => 'Rejected.', 'data' => $timesheet->fresh('user')]);
    }

    public function leaveDays(Request $request): JsonResponse
    {
        $request->validate([
            'week_start' => ['required', 'date'],
            'week_end'   => ['required', 'date', 'after_or_equal:week_start'],
        ]);

        $user      = $request->user();
        $weekStart = Carbon::parse($request->week_start);
        $weekEnd   = Carbon::parse($request->week_end);

        $leaves = LeaveRequest::where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted'])
            ->where('start_date', '<=', $weekEnd->format('Y-m-d'))
            ->where('end_date', '>=', $weekStart->format('Y-m-d'))
            ->get(['leave_type', 'status', 'start_date', 'end_date']);

        $map = [];
        foreach ($leaves as $leave) {
            $current = Carbon::parse($leave->start_date);
            $end     = Carbon::parse($leave->end_date);
            while ($current->lte($end)) {
                if ($current->isWeekday() && $current->between($weekStart, $weekEnd)) {
                    $map[$current->format('Y-m-d')] = [
                        'leave_type' => $leave->leave_type,
                        'status'     => $leave->status,
                    ];
                }
                $current->addDay();
            }
        }

        return response()->json(['data' => $map]);
    }

    public function team(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->canManageTimesheets($user)) {
            abort(403, 'Access restricted to HR supervisors and administrators.');
        }

        $filters = $request->only(['status', 'week_start', 'user_id', 'per_page']);

        $query = Timesheet::with(['user:id,name,email', 'entries.project'])
            ->where('timesheets.tenant_id', $user->tenant_id);

        // Supervisors see their direct reports; HR admins see all in tenant
        $isHrAdmin = $user->hasPermissionTo('hr.admin') || $user->hasPermissionTo('system.admin');
        if (!$isHrAdmin) {
            $superviseeIds = PerformanceTracker::where('supervisor_id', $user->id)
                ->pluck('employee_id')
                ->toArray();
            if (empty($superviseeIds)) {
                return response()->json(['data' => [], 'total' => 0, 'current_page' => 1, 'last_page' => 1]);
            }
            $query->whereIn('user_id', $superviseeIds);
        }

        // Exclude own timesheets
        $query->where('user_id', '!=', $user->id);

        if (!empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (!empty($filters['week_start'])) {
            $query->where('week_start', $filters['week_start']);
        }
        if (!empty($filters['user_id'])) {
            $query->where('user_id', (int) $filters['user_id']);
        }

        $query->orderByDesc('week_start');
        $paginated = $query->paginate($filters['per_page'] ?? 20);

        return response()->json($paginated);
    }

    /**
     * Import timesheet entries from CSV.
     */
    public function import(Request $request): JsonResponse
    {
        $request->validate([
            'file' => ['required', 'file', 'mimes:csv,txt', 'max:1024'],
        ]);

        $file = $request->file('file');
        $path = $file->getRealPath();
        $rows = array_map('str_getcsv', file($path));
        if (empty($rows)) {
            return response()->json([
                'message'  => 'File is empty or invalid.',
                'imported' => 0,
                'errors'   => ['No rows found.'],
            ], 422);
        }

        $header    = array_map('strtolower', array_map('trim', $rows[0]));
        $dateIdx   = array_search('date', $header);
        $hoursIdx  = array_search('hours', $header);
        $taskIdx   = array_search('task', $header);
        $projectIdx = array_search('project_code', $header);
        $notesIdx  = array_search('notes', $header);

        if ($dateIdx === false || $hoursIdx === false) {
            return response()->json([
                'message'  => 'CSV must have "date" and "hours" columns.',
                'imported' => 0,
                'errors'   => ['Missing required columns: date, hours'],
            ], 422);
        }

        $user        = $request->user();
        $errors      = [];
        $imported    = 0;
        $timesheetIds = [];

        for ($i = 1; $i < count($rows); $i++) {
            $row = $rows[$i];
            if (count($row) < max($dateIdx, $hoursIdx) + 1) {
                $errors[] = "Row " . ($i + 1) . ": not enough columns.";
                continue;
            }
            $dateStr     = trim($row[$dateIdx] ?? '');
            $hoursStr    = trim($row[$hoursIdx] ?? '');
            $description = trim($row[$taskIdx] ?? $row[$projectIdx] ?? '') ?: 'Work';
            if ($notesIdx !== false && isset($row[$notesIdx]) && trim($row[$notesIdx]) !== '') {
                $description .= ' – ' . trim($row[$notesIdx]);
            }

            $date = null;
            if ($dateStr !== '') {
                try {
                    $date = Carbon::parse($dateStr)->format('Y-m-d');
                } catch (\Throwable $e) {
                    $errors[] = "Row " . ($i + 1) . ": invalid date '{$dateStr}'.";
                    continue;
                }
            } else {
                $errors[] = "Row " . ($i + 1) . ": date is required.";
                continue;
            }

            $hours = null;
            if ($hoursStr !== '' && is_numeric($hoursStr)) {
                $hours = (float) $hoursStr;
                if ($hours < 0 || $hours > 24) {
                    $errors[] = "Row " . ($i + 1) . ": hours must be between 0 and 24.";
                    continue;
                }
            } else {
                $errors[] = "Row " . ($i + 1) . ": hours must be a number.";
                continue;
            }

            $weekStart = Carbon::parse($date)->startOfWeek(Carbon::MONDAY)->format('Y-m-d');
            $weekEnd   = Carbon::parse($weekStart)->addDays(6)->format('Y-m-d');

            $timesheet = Timesheet::where('user_id', $user->id)
                ->where('week_start', $weekStart)
                ->first();

            if (!$timesheet) {
                $timesheet = Timesheet::create([
                    'tenant_id'      => $user->tenant_id,
                    'user_id'        => $user->id,
                    'week_start'     => $weekStart,
                    'week_end'       => $weekEnd,
                    'total_hours'    => 0,
                    'overtime_hours' => 0,
                    'status'         => 'draft',
                ]);
                $timesheetIds[] = $timesheet->id;
            } elseif ($timesheet->status !== 'draft') {
                $errors[] = "Row " . ($i + 1) . ": week of {$date} is already submitted/approved; skipped.";
                continue;
            }

            TimesheetEntry::create([
                'timesheet_id'   => $timesheet->id,
                'work_date'      => $date,
                'hours'          => $hours,
                'overtime_hours' => max(0, $hours - 8),
                'description'    => $description,
            ]);
            $imported++;
            if (!in_array($timesheet->id, $timesheetIds)) {
                $timesheetIds[] = $timesheet->id;
            }
        }

        foreach (array_unique($timesheetIds) as $tid) {
            $ts = Timesheet::find($tid);
            if ($ts) {
                $total    = $ts->entries()->sum('hours');
                $overtime = $ts->entries()->sum('overtime_hours');
                $ts->update(['total_hours' => $total, 'overtime_hours' => $overtime]);
            }
        }

        return response()->json([
            'message'  => $imported > 0 ? 'Import completed.' : 'No rows imported.',
            'imported' => $imported,
            'errors'   => array_slice($errors, 0, 20),
        ]);
    }

    private function canManageTimesheets($user): bool
    {
        return $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr.approve')
            || $user->hasPermissionTo('hr.edit');
    }

    private function isSystemAdmin($user): bool
    {
        return $user->hasPermissionTo('system.admin')
            || $user->hasPermissionTo('hr.admin');
    }
}
