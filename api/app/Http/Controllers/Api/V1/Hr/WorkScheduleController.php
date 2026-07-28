<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\EmployeeScheduleAssignment;
use App\Models\EmployeeWorkSchedule;
use App\Models\TimesheetPeriod;
use App\Models\User;
use App\Modules\Timesheets\Services\TimesheetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class WorkScheduleController extends Controller
{
    public function __construct(private readonly TimesheetService $timesheetService) {}

    public function index(Request $request): JsonResponse
    {
        $this->timesheetService->ensureDefaultSchedule((int) $request->user()->tenant_id);

        $schedules = EmployeeWorkSchedule::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('is_default')
            ->orderBy('name')
            ->get();

        return response()->json(['data' => $schedules]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'code' => ['nullable', 'string', 'max:40'],
            'is_default' => ['nullable', 'boolean'],
            'working_days' => ['required', 'array', 'min:1'],
            'working_days.*' => ['integer', 'min:1', 'max:7'],
            'start_time' => ['required', 'date_format:H:i'],
            'end_time' => ['required', 'date_format:H:i'],
            'lunch_start' => ['nullable', 'date_format:H:i'],
            'lunch_end' => ['nullable', 'date_format:H:i'],
            'ordinary_hours_per_day' => ['required', 'numeric', 'min:1', 'max:12'],
        ]);

        if (! empty($data['is_default'])) {
            EmployeeWorkSchedule::where('tenant_id', $request->user()->tenant_id)
                ->update(['is_default' => false]);
        }

        $schedule = EmployeeWorkSchedule::create([
            ...$data,
            'tenant_id' => $request->user()->tenant_id,
            'is_active' => true,
            'start_time' => $data['start_time'].':00',
            'end_time' => $data['end_time'].':00',
            'lunch_start' => isset($data['lunch_start']) ? $data['lunch_start'].':00' : null,
            'lunch_end' => isset($data['lunch_end']) ? $data['lunch_end'].':00' : null,
        ]);

        return response()->json(['message' => 'Schedule created.', 'data' => $schedule], 201);
    }

    public function assign(Request $request): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'work_schedule_id' => ['required', 'integer', 'exists:employee_work_schedules,id'],
            'effective_from' => ['required', 'date'],
            'effective_to' => ['nullable', 'date', 'after_or_equal:effective_from'],
        ]);

        $assignment = EmployeeScheduleAssignment::create([
            'tenant_id' => $request->user()->tenant_id,
            'user_id' => $data['user_id'],
            'work_schedule_id' => $data['work_schedule_id'],
            'effective_from' => $data['effective_from'],
            'effective_to' => $data['effective_to'] ?? null,
            'assigned_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Schedule assigned.', 'data' => $assignment->load('schedule')], 201);
    }

    public function expectedHours(Request $request): JsonResponse
    {
        $data = $request->validate([
            'week_start' => ['required', 'date'],
            'week_end' => ['required', 'date', 'after_or_equal:week_start'],
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
        ]);

        $user = $request->user();
        if (! empty($data['user_id']) && (int) $data['user_id'] !== (int) $user->id) {
            $user = User::where('tenant_id', $user->tenant_id)->findOrFail($data['user_id']);
        }

        $result = $this->timesheetService->calculateExpectedHours($user, $data['week_start'], $data['week_end']);

        return response()->json(['data' => $result]);
    }

    public function periods(Request $request): JsonResponse
    {
        $periods = TimesheetPeriod::where('tenant_id', $request->user()->tenant_id)
            ->orderByDesc('period_start')
            ->paginate($request->integer('per_page', 20));

        return response()->json($periods);
    }

    public function closePeriod(Request $request, TimesheetPeriod $timesheetPeriod): JsonResponse
    {
        abort_unless((int) $timesheetPeriod->tenant_id === (int) $request->user()->tenant_id, 403);

        $timesheetPeriod->update([
            'status' => TimesheetPeriod::CLOSED,
            'closed_at' => now(),
            'closed_by' => $request->user()->id,
        ]);

        return response()->json(['message' => 'Period closed.', 'data' => $timesheetPeriod]);
    }
}
