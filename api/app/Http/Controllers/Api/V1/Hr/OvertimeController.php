<?php

namespace App\Http\Controllers\Api\V1\Hr;

use App\Http\Controllers\Controller;
use App\Models\OvertimeActualEntry;
use App\Models\OvertimeRequisition;
use App\Modules\Timesheets\Services\OvertimeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OvertimeController extends Controller
{
    public function __construct(private readonly OvertimeService $overtimeService) {}

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = OvertimeRequisition::with(['employees.user', 'requester', 'actuals'])
            ->where('tenant_id', $user->tenant_id)
            ->orderByDesc('work_date');

        if (! $user->can('overtime.approve') && ! $user->can('overtime.hr-validate') && ! $user->can('timesheets.admin')) {
            $query->where(function ($q) use ($user) {
                $q->where('requested_by', $user->id)
                    ->orWhereHas('employees', fn ($e) => $e->where('user_id', $user->id));
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->status);
        }

        return response()->json($query->paginate($request->integer('per_page', 20)));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'work_date' => ['required', 'date'],
            'planned_hours' => ['required', 'numeric', 'min:0.25', 'max:16'],
            'planned_start' => ['nullable', 'date_format:H:i'],
            'planned_end' => ['nullable', 'date_format:H:i'],
            'day_type' => ['nullable', 'string', 'in:normal_working_day,weekend,public_holiday'],
            'reason' => ['required', 'string', 'max:1000'],
            'work_location' => ['nullable', 'string', 'max:255'],
            'assignment_id' => ['nullable', 'integer'],
            'pif_id' => ['nullable', 'integer'],
            'department_id' => ['nullable', 'integer', 'exists:departments,id'],
            'employee_ids' => ['nullable', 'array'],
            'employee_ids.*' => ['integer', 'exists:users,id'],
            'is_emergency' => ['nullable', 'boolean'],
            'emergency_justification' => ['nullable', 'string', 'max:2000'],
        ]);

        $req = $this->overtimeService->createRequisition($request->user(), $data);

        return response()->json(['message' => 'Overtime requisition created.', 'data' => $req], 201);
    }

    public function show(OvertimeRequisition $overtimeRequisition): JsonResponse
    {
        return response()->json([
            'data' => $overtimeRequisition->load(['employees.user', 'requester', 'actuals.settlement']),
        ]);
    }

    public function submit(Request $request, OvertimeRequisition $overtimeRequisition): JsonResponse
    {
        $req = $this->overtimeService->submitRequisition($overtimeRequisition, $request->user());

        return response()->json(['message' => 'Submitted.', 'data' => $req]);
    }

    public function recommend(Request $request, OvertimeRequisition $overtimeRequisition): JsonResponse
    {
        $req = $this->overtimeService->recommend($overtimeRequisition, $request->user());

        return response()->json(['message' => 'Recommended.', 'data' => $req]);
    }

    public function approve(Request $request, OvertimeRequisition $overtimeRequisition): JsonResponse
    {
        $req = $this->overtimeService->approveRequisition($overtimeRequisition, $request->user());

        return response()->json(['message' => 'Approved.', 'data' => $req]);
    }

    public function reject(Request $request, OvertimeRequisition $overtimeRequisition): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $req = $this->overtimeService->rejectRequisition($overtimeRequisition, $request->user(), $data['reason']);

        return response()->json(['message' => 'Rejected.', 'data' => $req]);
    }

    public function recordActual(Request $request, OvertimeRequisition $overtimeRequisition): JsonResponse
    {
        $data = $request->validate([
            'user_id' => ['nullable', 'integer', 'exists:users,id'],
            'work_date' => ['nullable', 'date'],
            'actual_hours' => ['required', 'numeric', 'min:0.25', 'max:16'],
            'actual_start' => ['nullable', 'date_format:H:i'],
            'actual_end' => ['nullable', 'date_format:H:i'],
            'day_type' => ['nullable', 'string', 'in:normal_working_day,weekend,public_holiday'],
            'timesheet_id' => ['nullable', 'integer', 'exists:timesheets,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $actual = $this->overtimeService->recordActual($overtimeRequisition, $request->user(), $data);

        return response()->json(['message' => 'Actual overtime recorded.', 'data' => $actual], 201);
    }

    public function hrValidate(Request $request, OvertimeActualEntry $overtimeActual): JsonResponse
    {
        $actual = $this->overtimeService->hrValidate($overtimeActual, $request->user());

        return response()->json(['message' => 'HR validated.', 'data' => $actual]);
    }

    public function sendToPayroll(Request $request, OvertimeActualEntry $overtimeActual): JsonResponse
    {
        $data = $request->validate([
            'idempotency_key' => ['nullable', 'string', 'max:80'],
        ]);
        $settlement = $this->overtimeService->settle(
            $overtimeActual,
            $request->user(),
            \App\Models\OvertimeSettlement::TYPE_PAY,
            $data['idempotency_key'] ?? null
        );

        return response()->json(['message' => 'Settled for payroll.', 'data' => $settlement]);
    }

    public function sendToToil(Request $request, OvertimeActualEntry $overtimeActual): JsonResponse
    {
        $data = $request->validate([
            'idempotency_key' => ['nullable', 'string', 'max:80'],
        ]);
        $settlement = $this->overtimeService->settle(
            $overtimeActual,
            $request->user(),
            \App\Models\OvertimeSettlement::TYPE_TOIL,
            $data['idempotency_key'] ?? null
        );

        return response()->json(['message' => 'Transferred to TOIL.', 'data' => $settlement]);
    }

    public function exportPayroll(Request $request): JsonResponse
    {
        $data = $request->validate([
            'settlement_ids' => ['required', 'array', 'min:1'],
            'settlement_ids.*' => ['integer'],
            'idempotency_key' => ['nullable', 'string', 'max:80'],
        ]);

        $batch = $this->overtimeService->exportPayroll(
            $request->user(),
            $data['settlement_ids'],
            $data['idempotency_key'] ?? null
        );

        return response()->json(['message' => 'Payroll export created.', 'data' => $batch], 201);
    }
}
