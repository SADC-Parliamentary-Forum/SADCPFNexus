<?php
namespace App\Http\Controllers\Api\V1\Leave;

use App\Http\Controllers\Controller;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\OvertimeAccrual;
use App\Modules\Leave\Services\LeaveService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LeaveController extends Controller
{
    public function __construct(private readonly LeaveService $leaveService) {}

    /** Leave balances for the current user (annual days, LIL hours, sick used). */
    public function balances(Request $request): JsonResponse
    {
        $user = $request->user();
        $year = (int) date('Y');
        $balance = LeaveBalance::where('user_id', $user->id)
            ->where('period_year', $year)
            ->first();

        return response()->json([
            'annual_balance_days'   => $balance ? (int) $balance->annual_balance_days : 0,
            'lil_hours_available'   => $balance ? (float) $balance->lil_hours_available : 0,
            'sick_leave_used_days'  => $balance ? (int) $balance->sick_leave_used_days : 0,
            'period_year'           => $year,
        ]);
    }

    /** Return LIL (leave-in-lieu) accruals available for the current user to link. */
    public function lilAccruals(Request $request): JsonResponse
    {
        $user = $request->user();
        $rows = OvertimeAccrual::where('user_id', $user->id)
            ->where('is_linked', false)
            ->orderByDesc('accrual_date')
            ->get();

        $data = $rows->map(fn ($r) => [
            'id'           => (string) $r->id,
            'code'         => $r->code,
            'description'  => $r->description ?? '',
            'hours'        => (float) $r->hours,
            'date'         => $r->accrual_date->format('Y-m-d'),
            'approved_by'  => $r->approved_by_name,
            'is_verified'  => $r->is_verified,
        ]);

        return response()->json(['data' => $data]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'leave_type', 'per_page']);
        return response()->json($this->leaveService->list($filters, $request->user()));
    }

    public function show(LeaveRequest $leaveRequest): JsonResponse
    {
        return response()->json($leaveRequest->load(['requester', 'approver', 'lilLinkings']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'leave_type'  => ['required', 'string', 'in:annual,sick,lil,special,maternity,paternity'],
            'start_date'  => ['required', 'date', 'after_or_equal:today'],
            'end_date'    => ['required', 'date', 'after_or_equal:start_date'],
            'reason'      => ['nullable', 'string', 'max:2000'],
            'lil_linkings'               => ['nullable', 'array'],
            'lil_linkings.*.accrual_code'        => ['required_with:lil_linkings', 'string'],
            'lil_linkings.*.accrual_description' => ['required_with:lil_linkings', 'string'],
            'lil_linkings.*.hours'               => ['required_with:lil_linkings', 'numeric', 'min:0.5'],
            'lil_linkings.*.accrual_date'        => ['required_with:lil_linkings', 'date'],
            'lil_linkings.*.approved_by_name'    => ['nullable', 'string'],
        ]);

        $leave = $this->leaveService->create($data, $request->user());
        return response()->json(['message' => 'Leave request created.', 'data' => $leave], 201);
    }

    public function update(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate([
            'leave_type' => ['sometimes', 'string', 'in:annual,sick,lil,special,maternity,paternity'],
            'start_date' => ['sometimes', 'date'],
            'end_date'   => ['sometimes', 'date', 'after_or_equal:start_date'],
            'reason'     => ['nullable', 'string', 'max:2000'],
        ]);

        $leave = $this->leaveService->update($leaveRequest, $data, $request->user());
        return response()->json(['message' => 'Leave request updated.', 'data' => $leave]);
    }

    public function destroy(LeaveRequest $leaveRequest): JsonResponse
    {
        if (!$leaveRequest->isDraft()) {
            return response()->json(['message' => 'Only draft requests can be deleted.'], 422);
        }
        $leaveRequest->delete();
        return response()->json(['message' => 'Leave request deleted.']);
    }

    public function submit(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $leave = $this->leaveService->submit($leaveRequest, $request->user());
        return response()->json(['message' => 'Leave request submitted.', 'data' => $leave]);
    }

    public function approve(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $leave = $this->leaveService->approve($leaveRequest, $request->user());
        return response()->json(['message' => 'Leave request approved.', 'data' => $leave]);
    }

    public function reject(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $leave = $this->leaveService->reject($leaveRequest, $data['reason'], $request->user());
        return response()->json(['message' => 'Leave request rejected.', 'data' => $leave]);
    }
}
