<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\LeaveRequest;
use App\Models\PayrollExportBatch;
use App\Models\PerformanceTracker;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\TimesheetProject;
use App\Models\TimesheetTemplate;
use App\Modules\Timesheets\Services\TimesheetExportService;
use App\Modules\Timesheets\Services\TimesheetPayrollExportService;
use App\Modules\Timesheets\Services\TimesheetService;
use App\Services\WorkflowService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\StreamedResponse;

class TimesheetController extends Controller
{
    public function __construct(
        private readonly TimesheetService $timesheetService,
        private readonly TimesheetExportService $exportService,
        private readonly TimesheetPayrollExportService $payrollExportService,
        private readonly WorkflowService $workflowService,
        private readonly \App\Modules\Timesheets\Services\TimesheetCapacityAnalyticsService $capacityAnalytics,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'per_page', 'week_start', 'month', 'year']);
        $query = Timesheet::with(['user', 'entries.project'])
            ->where('user_id', $request->user()->id)
            ->orderByDesc('week_start');

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['week_start'])) {
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
        if ($timesheet->user_id !== request()->user()->id && ! $this->canManageTimesheets(request()->user())) {
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
            'week_start' => ['required', 'date'],
            'week_end' => ['required', 'date', 'after_or_equal:week_start'],
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.work_date' => ['required', 'date'],
            'entries.*.hours' => ['required', 'numeric', 'min:0', 'max:24'],
            'entries.*.overtime_hours' => ['nullable', 'numeric', 'min:0', 'max:12'],
            'entries.*.description' => ['nullable', 'string', 'max:500'],
            'entries.*.project_id' => ['nullable', 'integer', 'exists:timesheet_projects,id'],
            'entries.*.work_bucket' => ['nullable', 'string', 'in:'.implode(',', TimesheetEntry::WORK_BUCKETS)],
            'entries.*.activity_type' => ['nullable', 'string', 'max:100'],
            'entries.*.entry_category' => ['nullable', 'string', 'max:64'],
            'entries.*.work_assignment_id' => ['nullable', 'integer', 'exists:work_assignments,id'],
            'entries.*.assignment_id' => ['nullable', 'integer'],
            'entries.*.pif_id' => ['nullable', 'integer'],
            'entries.*.programme_id' => ['nullable', 'integer'],
            'entries.*.start_time' => ['nullable', 'date_format:H:i'],
            'entries.*.end_time' => ['nullable', 'date_format:H:i'],
            'entries.*.source_type' => ['nullable', 'string', 'in:manual,leave,travel,holiday'],
            'entries.*.source_record_id' => ['nullable', 'integer'],
        ]);

        $user = $request->user();
        $this->timesheetService->validateEntries($user, $data['week_start'], $data['week_end'], $data['entries']);

        $total = 0;
        $overtime = 0;
        foreach ($data['entries'] as $e) {
            $total += (float) $e['hours'];
            $overtime += (float) ($e['overtime_hours'] ?? 0);
        }

        $weekNumber = Carbon::parse($data['week_start'])->isoWeek();
        $period = $this->timesheetService->ensurePeriod((int) $user->tenant_id, $data['week_start'], $data['week_end']);
        $this->timesheetService->assertPeriodEditable($period);

        $timesheet = Timesheet::create([
            'tenant_id' => $user->tenant_id,
            'period_id' => $period->id,
            'user_id' => $user->id,
            'week_start' => $data['week_start'],
            'week_end' => $data['week_end'],
            'week_number' => $weekNumber,
            'total_hours' => $total,
            'overtime_hours' => $overtime,
            'status' => 'draft',
        ]);

        foreach ($data['entries'] as $e) {
            TimesheetEntry::create([
                'timesheet_id' => $timesheet->id,
                'work_date' => $e['work_date'],
                'start_time' => isset($e['start_time']) ? $e['start_time'].':00' : null,
                'end_time' => isset($e['end_time']) ? $e['end_time'].':00' : null,
                'hours' => $e['hours'],
                'overtime_hours' => $e['overtime_hours'] ?? 0,
                'description' => $e['description'] ?? null,
                'project_id' => $e['project_id'] ?? null,
                'work_bucket' => $e['work_bucket'] ?? null,
                'activity_type' => $e['activity_type'] ?? null,
                'entry_category' => $e['entry_category'] ?? null,
                'work_assignment_id' => $e['work_assignment_id'] ?? null,
                'assignment_id' => $e['assignment_id'] ?? null,
                'pif_id' => $e['pif_id'] ?? null,
                'programme_id' => $e['programme_id'] ?? null,
                'source_type' => $e['source_type'] ?? 'manual',
                'source_record_id' => $e['source_record_id'] ?? null,
                'is_locked' => in_array($e['source_type'] ?? 'manual', ['leave', 'travel', 'holiday']),
            ]);
        }

        $this->timesheetService->syncTimesheetDays($timesheet->fresh(), $user);

        return response()->json(['message' => 'Timesheet created.', 'data' => $timesheet->fresh(['entries.project', 'entries.workAssignment', 'user', 'days'])], 201);
    }

    public function update(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== $request->user()->id) {
            abort(403);
        }
        if (! in_array($timesheet->status, ['draft', 'returned'], true)) {
            throw ValidationException::withMessages(['status' => 'Only draft or returned timesheets can be edited. Silent edits of submitted timesheets are not allowed.']);
        }

        $data = $request->validate([
            'entries' => ['required', 'array', 'min:1'],
            'entries.*.work_date' => ['required', 'date'],
            'entries.*.hours' => ['required', 'numeric', 'min:0', 'max:24'],
            'entries.*.overtime_hours' => ['nullable', 'numeric', 'min:0', 'max:12'],
            'entries.*.description' => ['nullable', 'string', 'max:500'],
            'entries.*.project_id' => ['nullable', 'integer', 'exists:timesheet_projects,id'],
            'entries.*.work_bucket' => ['nullable', 'string', 'in:'.implode(',', TimesheetEntry::WORK_BUCKETS)],
            'entries.*.activity_type' => ['nullable', 'string', 'max:100'],
            'entries.*.entry_category' => ['nullable', 'string', 'max:64'],
            'entries.*.work_assignment_id' => ['nullable', 'integer', 'exists:work_assignments,id'],
            'entries.*.assignment_id' => ['nullable', 'integer'],
            'entries.*.pif_id' => ['nullable', 'integer'],
            'entries.*.programme_id' => ['nullable', 'integer'],
            'entries.*.start_time' => ['nullable', 'date_format:H:i'],
            'entries.*.end_time' => ['nullable', 'date_format:H:i'],
            'entries.*.source_type' => ['nullable', 'string', 'in:manual,leave,travel,holiday'],
            'entries.*.source_record_id' => ['nullable', 'integer'],
        ]);

        $this->timesheetService->validateEntries(
            $request->user(),
            $timesheet->week_start->format('Y-m-d'),
            $timesheet->week_end->format('Y-m-d'),
            $data['entries']
        );
        if ($timesheet->period_id) {
            $this->timesheetService->assertPeriodEditable($timesheet->period);
        }

        $total = 0;
        $overtime = 0;
        foreach ($data['entries'] as $e) {
            $total += (float) $e['hours'];
            $overtime += (float) ($e['overtime_hours'] ?? 0);
        }

        $timesheet->update(['total_hours' => $total, 'overtime_hours' => $overtime, 'status' => 'draft']);
        $timesheet->entries()->delete();
        foreach ($data['entries'] as $e) {
            TimesheetEntry::create([
                'timesheet_id' => $timesheet->id,
                'work_date' => $e['work_date'],
                'start_time' => isset($e['start_time']) ? $e['start_time'].':00' : null,
                'end_time' => isset($e['end_time']) ? $e['end_time'].':00' : null,
                'hours' => $e['hours'],
                'overtime_hours' => $e['overtime_hours'] ?? 0,
                'description' => $e['description'] ?? null,
                'project_id' => $e['project_id'] ?? null,
                'work_bucket' => $e['work_bucket'] ?? null,
                'activity_type' => $e['activity_type'] ?? null,
                'entry_category' => $e['entry_category'] ?? null,
                'work_assignment_id' => $e['work_assignment_id'] ?? null,
                'assignment_id' => $e['assignment_id'] ?? null,
                'pif_id' => $e['pif_id'] ?? null,
                'programme_id' => $e['programme_id'] ?? null,
                'source_type' => $e['source_type'] ?? 'manual',
                'source_record_id' => $e['source_record_id'] ?? null,
                'is_locked' => in_array($e['source_type'] ?? 'manual', ['leave', 'travel', 'holiday']),
            ]);
        }

        $this->timesheetService->syncTimesheetDays($timesheet->fresh(), $request->user());
        $this->timesheetService->audit($timesheet, $request->user(), 'timesheet.updated');

        return response()->json(['message' => 'Updated.', 'data' => $timesheet->fresh(['entries.project', 'entries.workAssignment', 'user', 'days'])]);
    }

    public function submit(Request $request, Timesheet $timesheet): JsonResponse
    {
        if ($timesheet->user_id !== $request->user()->id) {
            abort(403);
        }

        $data = $request->validate([
            'declaration_accepted' => ['nullable', 'boolean'],
        ]);

        $timesheet = $this->timesheetService->submit(
            $timesheet,
            $request->user(),
            $data['declaration_accepted'] ?? true
        );

        return response()->json(['message' => 'Submitted.', 'data' => $timesheet->fresh('user')]);
    }

    public function returnTimesheet(Request $request, Timesheet $timesheet): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $timesheet = $this->timesheetService->returnToEmployee($timesheet, $request->user(), $data['reason']);

        return response()->json(['message' => 'Returned to employee.', 'data' => $timesheet]);
    }

    public function approve(Request $request, Timesheet $timesheet): JsonResponse
    {
        $timesheet = $this->timesheetService->approve($timesheet, $request->user(), $request->input('comment'));

        return response()->json(['message' => 'Approved.', 'data' => $timesheet]);
    }

    public function reject(Request $request, Timesheet $timesheet): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        if ($timesheet->status !== 'submitted') {
            throw ValidationException::withMessages(['status' => 'Only submitted timesheets can be rejected.']);
        }

        // Use workflow service if a workflow request exists, otherwise direct reject
        if ($timesheet->approvalRequest) {
            $this->workflowService->reject($timesheet->approvalRequest, $request->user(), $data['reason']);
            $timesheet->refresh();
        } else {
            $timesheet->update(['status' => 'rejected', 'rejection_reason' => $data['reason']]);
            $this->timesheetService->onWorkflowRejected($timesheet, $request->user(), $data['reason']);
        }

        return response()->json(['message' => 'Rejected.', 'data' => $timesheet->fresh('user')]);
    }

    public function leaveDays(Request $request): JsonResponse
    {
        $request->validate([
            'week_start' => ['required', 'date'],
            'week_end' => ['required', 'date', 'after_or_equal:week_start'],
        ]);

        $user = $request->user();
        $weekStart = Carbon::parse($request->week_start);
        $weekEnd = Carbon::parse($request->week_end);

        $leaves = LeaveRequest::where('requester_id', $user->id)
            ->whereIn('status', ['approved', 'submitted'])
            ->where('start_date', '<=', $weekEnd->format('Y-m-d'))
            ->where('end_date', '>=', $weekStart->format('Y-m-d'))
            ->get(['leave_type', 'status', 'start_date', 'end_date']);

        $map = [];
        foreach ($leaves as $leave) {
            $current = Carbon::parse($leave->start_date);
            $end = Carbon::parse($leave->end_date);
            while ($current->lte($end)) {
                if ($current->isWeekday() && $current->between($weekStart, $weekEnd)) {
                    $map[$current->format('Y-m-d')] = [
                        'leave_type' => $leave->leave_type,
                        'status' => $leave->status,
                    ];
                }
                $current->addDay();
            }
        }

        return response()->json(['data' => $map]);
    }

    public function travelDays(Request $request): JsonResponse
    {
        $request->validate([
            'week_start' => ['required', 'date'],
            'week_end' => ['required', 'date', 'after_or_equal:week_start'],
        ]);

        $map = $this->timesheetService->getTravelDays(
            $request->user(),
            $request->week_start,
            $request->week_end
        );

        return response()->json(['data' => $map]);
    }

    public function holidayDates(Request $request): JsonResponse
    {
        $request->validate([
            'start' => ['required', 'date'],
            'end' => ['required', 'date', 'after_or_equal:start'],
        ]);

        $map = $this->timesheetService->getHolidayDates(
            $request->user(),
            $request->start,
            $request->end
        );

        return response()->json(['data' => $map]);
    }

    public function team(Request $request): JsonResponse
    {
        $user = $request->user();
        if (! $this->canManageTimesheets($user)) {
            abort(403, 'Access restricted to HR supervisors and administrators.');
        }

        $filters = $request->only(['status', 'week_start', 'user_id', 'per_page']);

        $query = Timesheet::with(['user:id,name,email', 'entries.project'])
            ->where('timesheets.tenant_id', $user->tenant_id);

        // Supervisors see their direct reports; HR admins see all in tenant
        $isHrAdmin = $user->hasPermissionTo('hr.admin') || $user->hasPermissionTo('system.admin');
        if (! $isHrAdmin) {
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

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['week_start'])) {
            $query->where('week_start', $filters['week_start']);
        }
        if (! empty($filters['user_id'])) {
            $query->where('user_id', (int) $filters['user_id']);
        }

        $query->orderByDesc('week_start');
        $paginated = $query->paginate($filters['per_page'] ?? 20);

        return response()->json($paginated);
    }

    public function capacityAnalytics(Request $request): JsonResponse
    {
        $data = $request->validate([
            'week_start' => ['required', 'date'],
            'week_end' => ['required', 'date', 'after_or_equal:week_start'],
            'department_id' => ['nullable', 'integer'],
        ]);

        return response()->json([
            'data' => $this->capacityAnalytics->analytics(
                $request->user(),
                $data['week_start'],
                $data['week_end'],
                isset($data['department_id']) ? (int) $data['department_id'] : null
            ),
        ]);
    }

    public function clockAttendance(Request $request): JsonResponse
    {
        $data = $request->validate([
            'direction' => ['required', 'string', 'in:in,out'],
            'method' => ['nullable', 'string', 'in:manual,biometric,badge'],
            'device_attested' => ['nullable', 'boolean'],
            'device_id' => ['nullable', 'string', 'max:128'],
        ]);

        $event = app(\App\Modules\Timesheets\Services\AttendanceClockService::class)
            ->clock($request->user(), $data);

        return response()->json(['data' => $event], 201);
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
                'message' => 'File is empty or invalid.',
                'imported' => 0,
                'errors' => ['No rows found.'],
            ], 422);
        }

        $header = array_map('strtolower', array_map('trim', $rows[0]));
        $dateIdx = array_search('date', $header);
        $hoursIdx = array_search('hours', $header);
        $taskIdx = array_search('task', $header);
        $projectIdx = array_search('project_code', $header);
        $notesIdx = array_search('notes', $header);

        if ($dateIdx === false || $hoursIdx === false) {
            return response()->json([
                'message' => 'CSV must have "date" and "hours" columns.',
                'imported' => 0,
                'errors' => ['Missing required columns: date, hours'],
            ], 422);
        }

        $user = $request->user();
        $errors = [];
        $imported = 0;
        $timesheetIds = [];

        for ($i = 1; $i < count($rows); $i++) {
            $row = $rows[$i];
            if (count($row) < max($dateIdx, $hoursIdx) + 1) {
                $errors[] = 'Row '.($i + 1).': not enough columns.';

                continue;
            }
            $dateStr = trim($row[$dateIdx] ?? '');
            $hoursStr = trim($row[$hoursIdx] ?? '');
            $description = trim($row[$taskIdx] ?? $row[$projectIdx] ?? '') ?: 'Work';
            if ($notesIdx !== false && isset($row[$notesIdx]) && trim($row[$notesIdx]) !== '') {
                $description .= ' – '.trim($row[$notesIdx]);
            }

            $date = null;
            if ($dateStr !== '') {
                try {
                    $date = Carbon::parse($dateStr)->format('Y-m-d');
                } catch (\Throwable $e) {
                    $errors[] = 'Row '.($i + 1).": invalid date '{$dateStr}'.";

                    continue;
                }
            } else {
                $errors[] = 'Row '.($i + 1).': date is required.';

                continue;
            }

            $hours = null;
            if ($hoursStr !== '' && is_numeric($hoursStr)) {
                $hours = (float) $hoursStr;
                if ($hours < 0 || $hours > 24) {
                    $errors[] = 'Row '.($i + 1).': hours must be between 0 and 24.';

                    continue;
                }
            } else {
                $errors[] = 'Row '.($i + 1).': hours must be a number.';

                continue;
            }

            $weekStart = Carbon::parse($date)->startOfWeek(Carbon::MONDAY)->format('Y-m-d');
            $weekEnd = Carbon::parse($weekStart)->addDays(6)->format('Y-m-d');

            $timesheet = Timesheet::where('user_id', $user->id)
                ->where('week_start', $weekStart)
                ->first();

            if (! $timesheet) {
                $timesheet = Timesheet::create([
                    'tenant_id' => $user->tenant_id,
                    'user_id' => $user->id,
                    'week_start' => $weekStart,
                    'week_end' => $weekEnd,
                    'week_number' => Carbon::parse($weekStart)->isoWeek(),
                    'total_hours' => 0,
                    'overtime_hours' => 0,
                    'status' => 'draft',
                ]);
                $timesheetIds[] = $timesheet->id;
            } elseif ($timesheet->status !== 'draft') {
                $errors[] = 'Row '.($i + 1).": week of {$date} is already submitted/approved; skipped.";

                continue;
            }

            TimesheetEntry::create([
                'timesheet_id' => $timesheet->id,
                'work_date' => $date,
                'hours' => $hours,
                'overtime_hours' => max(0, $hours - 8),
                'description' => $description,
                'source_type' => 'manual',
            ]);
            $imported++;
            if (! in_array($timesheet->id, $timesheetIds)) {
                $timesheetIds[] = $timesheet->id;
            }
        }

        foreach (array_unique($timesheetIds) as $tid) {
            $ts = Timesheet::find($tid);
            if ($ts) {
                $total = $ts->entries()->sum('hours');
                $overtime = $ts->entries()->sum('overtime_hours');
                $ts->update(['total_hours' => $total, 'overtime_hours' => $overtime]);
            }
        }

        return response()->json([
            'message' => $imported > 0 ? 'Import completed.' : 'No rows imported.',
            'imported' => $imported,
            'errors' => array_slice($errors, 0, 20),
        ]);
    }

    public function templates(Request $request): JsonResponse
    {
        $user = $request->user();
        $includeInactive = filter_var($request->query('include_inactive'), FILTER_VALIDATE_BOOLEAN);
        $canAdminTemplates = $this->canAdministerTemplates($user);

        $query = TimesheetTemplate::query()
            ->where('tenant_id', $user->tenant_id)
            ->orderBy('sort_order')
            ->orderBy('name');

        if (! ($includeInactive && $canAdminTemplates)) {
            $query->where('is_active', true);
        }

        return response()->json(['data' => $query->get()]);
    }

    /**
     * Tenant-scoped charge-code list for timesheet entry and template defaults.
     * Catalog mutations stay on the admin timesheet-projects API.
     */
    public function projects(Request $request): JsonResponse
    {
        $tenantId = $request->user()?->tenant_id;
        if ($tenantId === null) {
            return response()->json(['data' => []]);
        }

        $projects = TimesheetProject::query()
            ->where('tenant_id', $tenantId)
            ->orderBy('sort_order')
            ->orderBy('label')
            ->orderBy('id')
            ->get(['id', 'label', 'sort_order']);

        return response()->json(['data' => $projects]);
    }

    public function storeTemplate(Request $request): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canAdministerTemplates($user), 403);

        $data = $request->validate($this->templateValidationRules(requiredCode: true));

        $template = TimesheetTemplate::create([
            'tenant_id' => $user->tenant_id,
            'name' => $data['name'],
            'code' => $data['code'],
            'donor_name' => $data['donor_name'] ?? null,
            'description' => $data['description'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
            'defaults' => $data['defaults'] ?? [],
        ]);

        return response()->json(['message' => 'Template created.', 'data' => $template], 201);
    }

    public function updateTemplate(Request $request, TimesheetTemplate $template): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canAdministerTemplates($user), 403);
        abort_unless((int) $template->tenant_id === (int) $user->tenant_id, 404);

        $data = $request->validate($this->templateValidationRules(requiredCode: false));

        $template->fill(collect($data)->only([
            'name', 'code', 'donor_name', 'description', 'is_active', 'sort_order', 'defaults',
        ])->all());
        $template->save();

        return response()->json(['message' => 'Template updated.', 'data' => $template->fresh()]);
    }

    public function deactivateTemplate(Request $request, TimesheetTemplate $template): JsonResponse
    {
        $user = $request->user();
        abort_unless($this->canAdministerTemplates($user), 403);
        abort_unless((int) $template->tenant_id === (int) $user->tenant_id, 404);

        $template->update(['is_active' => false]);

        return response()->json(['message' => 'Template deactivated.', 'data' => $template->fresh()]);
    }

    public function applyTemplate(Request $request, TimesheetTemplate $template): JsonResponse
    {
        $data = $request->validate([
            'week_start' => ['required', 'date'],
            'week_end' => ['required', 'date', 'after_or_equal:week_start'],
        ]);

        $timesheet = $this->exportService->applyTemplate(
            $request->user(),
            $template,
            $data['week_start'],
            $data['week_end']
        );

        return response()->json([
            'message' => 'Template applied.',
            'data' => [
                'template' => $template,
                'timesheet' => $timesheet,
            ],
        ], 201);
    }

    public function export(Request $request, Timesheet $timesheet): Response|StreamedResponse
    {
        $format = strtolower((string) $request->query('format', 'csv'));

        return $this->exportService->export($timesheet, $request->user(), $format);
    }

    public function stagePayrollExport(Request $request): JsonResponse
    {
        $data = $request->validate([
            'period_id' => ['required', 'integer', 'exists:timesheet_periods,id'],
            'idempotency_key' => ['nullable', 'string', 'max:80'],
            'mark_included' => ['nullable', 'boolean'],
            'lock_period' => ['nullable', 'boolean'],
        ]);

        $batch = $this->payrollExportService->stageFromPeriod(
            $request->user(),
            (int) $data['period_id'],
            $data['idempotency_key'] ?? null,
            (bool) ($data['mark_included'] ?? true),
            (bool) ($data['lock_period'] ?? false),
        );

        return response()->json([
            'message' => 'Payroll export batch staged.',
            'data' => $batch,
        ], 201);
    }

    public function listPayrollExports(Request $request): JsonResponse
    {
        $periodId = $request->integer('period_id') ?: null;

        return response()->json([
            'data' => $this->payrollExportService->listBatches($request->user(), $periodId),
        ]);
    }

    public function downloadPayrollExport(Request $request, PayrollExportBatch $payrollExport): StreamedResponse
    {
        $format = strtolower((string) $request->query('format', 'csv'));

        return $this->payrollExportService->download($payrollExport, $request->user(), $format);
    }

    private function canManageTimesheets($user): bool
    {
        return $user->hasPermissionTo('hr.admin')
            || $user->hasPermissionTo('hr.approve')
            || $user->hasPermissionTo('hr.edit');
    }

    private function canAdministerTemplates($user): bool
    {
        return $user->can('timesheets.admin')
            || $user->can('hr.admin')
            || $user->isSystemAdmin();
    }

    /**
     * @return array<string, mixed>
     */
    private function templateValidationRules(bool $requiredCode): array
    {
        return [
            'name' => [$requiredCode ? 'required' : 'sometimes', 'string', 'max:200'],
            'code' => [$requiredCode ? 'required' : 'sometimes', 'string', 'max:64'],
            'donor_name' => ['nullable', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'defaults' => ['nullable', 'array'],
            'defaults.project_id' => ['nullable', 'integer', 'exists:timesheet_projects,id'],
            'defaults.work_bucket' => ['nullable', 'string', 'in:'.implode(',', TimesheetEntry::WORK_BUCKETS)],
            'defaults.activity_type' => ['nullable', 'string', 'max:100'],
            'defaults.entry_category' => ['nullable', 'string', 'max:64'],
            'defaults.programme_id' => ['nullable', 'integer'],
            'defaults.pif_id' => ['nullable', 'integer'],
            'defaults.description' => ['nullable', 'string', 'max:500'],
            'defaults.hours' => ['nullable', 'numeric', 'min:0', 'max:24'],
        ];
    }
}
