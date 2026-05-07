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
    public function __construct(
        private readonly LeaveService $leaveService,
        private readonly \App\Services\WorkflowService $workflowService
    ) {}

    /** Leave balances for the current user (annual days, LIL hours, and used days per leave type). */
    public function balances(Request $request): JsonResponse
    {
        $user = $request->user();
        $year = (int) date('Y');
        $balance = LeaveBalance::where('user_id', $user->id)
            ->where('period_year', $year)
            ->first();

        // Compute used days per leave type from approved/submitted leave requests this year
        $usedByType = LeaveRequest::where('requester_id', $user->id)
            ->whereYear('start_date', $year)
            ->whereIn('status', ['approved', 'submitted'])
            ->selectRaw('leave_type, COALESCE(SUM(days_requested), 0)::int AS days_used')
            ->groupBy('leave_type')
            ->pluck('days_used', 'leave_type');

        return response()->json([
            'annual_balance_days'      => $balance ? (int) $balance->annual_balance_days : 0,
            'lil_hours_available'      => $balance ? (float) $balance->lil_hours_available : 0,
            'sick_leave_used_days'     => (int) ($usedByType['sick'] ?? ($balance?->sick_leave_used_days ?? 0)),
            'special_leave_days_used'  => (int) ($usedByType['special'] ?? 0),
            'maternity_leave_days_used'=> (int) ($usedByType['maternity'] ?? 0),
            'paternity_leave_days_used'=> (int) ($usedByType['paternity'] ?? 0),
            'period_year'              => $year,
        ]);
    }

    /** Return LIL accruals: overtime accruals + days from approved Travel Requisitions that fell on weekend or Namibia public holiday. */
    public function lilAccruals(Request $request): JsonResponse
    {
        $user = $request->user();

        $overtime = OvertimeAccrual::where('user_id', $user->id)
            ->where('is_linked', false)
            ->orderByDesc('accrual_date')
            ->get();

        $data = [];

        foreach ($overtime as $r) {
            $data[] = [
                'id'          => 'overtime-' . $r->id,
                'source_type' => 'overtime',
                'code'        => $r->code,
                'description' => $r->description ?? $r->code,
                'hours'       => (float) $r->hours,
                'date'        => $r->accrual_date->format('Y-m-d'),
                'approved_by' => $r->approved_by_name,
                'is_verified' => $r->is_verified,
            ];
        }

        $travelLil = $this->leaveService->getLilAccrualsFromApprovedTravel($user);
        foreach ($travelLil as $item) {
            $data[] = $item;
        }

        usort($data, fn ($a, $b) => strcmp($b['date'], $a['date']));

        return response()->json(['data' => $data]);
    }

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'leave_type', 'per_page']);
        return response()->json($this->leaveService->list($filters, $request->user()));
    }

    public function show(LeaveRequest $leaveRequest): JsonResponse
    {
        return response()->json($leaveRequest->load(['requester', 'approver', 'lilLinkings', 'approvalRequest.workflow.steps', 'approvalRequest.history.user']));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'leave_type'  => ['required', 'string', 'in:annual,sick,lil,special,maternity,paternity'],
            'start_date'  => ['required', 'date', 'after_or_equal:today'],
            'end_date'    => ['required', 'date', 'after_or_equal:start_date'],
            'reason'      => ['nullable', 'string', 'max:2000'],
            'lil_linkings'               => ['nullable', 'array'],
            'lil_linkings.*.source_id'           => ['nullable', 'string', 'max:64'],
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
        $data = $request->validate([
            'comment'         => ['nullable', 'string', 'max:1000'],
            'override_reason' => ['nullable', 'string', 'max:1000'],
        ]);

        $overrideReason = $data['override_reason'] ?? null;

        if (!$leaveRequest->approvalRequest) {
            $leave = $this->leaveService->approve($leaveRequest, $request->user(), $overrideReason);
            return response()->json(['message' => 'Leave request approved.', 'data' => $leave]);
        }

        $this->leaveService->validateLeaveBalance($leaveRequest, $overrideReason);

        $result = $this->workflowService->approve(
            $leaveRequest->approvalRequest,
            $request->user(),
            $data['comment'] ?? null
        );

        return response()->json([
            'message'            => 'Leave request approved.',
            'data'               => $leaveRequest->fresh(['requester', 'approver', 'approvalRequest']),
            'notified_approvers' => $result['notified_approvers'],
        ]);
    }

    public function reject(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate([
            'reason'  => ['nullable', 'string', 'max:1000'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $reason = $data['reason'] ?? $data['comment'] ?? null;
        if (!$reason) {
            return response()->json([
                'message' => 'The comment field is required.',
                'errors'  => ['comment' => ['The comment field is required.']],
            ], 422);
        }

        if (!$leaveRequest->approvalRequest) {
            $leave = $this->leaveService->reject($leaveRequest, $reason, $request->user());
            return response()->json(['message' => 'Leave request rejected.', 'data' => $leave]);
        }

        $this->workflowService->reject($leaveRequest->approvalRequest, $request->user(), $reason);

        return response()->json(['message' => 'Leave request rejected.', 'data' => $leaveRequest->fresh(['requester', 'approver', 'approvalRequest'])]);
    }

    public function returnForCorrection(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']]);
        abort_unless($leaveRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->returnForCorrection(
            $leaveRequest->approvalRequest,
            $request->user(),
            $data['comment']
        );
        return response()->json([
            'message' => 'Request returned to requester for correction.',
            'data'    => $leaveRequest->fresh(['requester', 'approver', 'approvalRequest']),
        ]);
    }

    public function withdraw(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        abort_unless($leaveRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->withdraw($leaveRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Leave request withdrawn.',
            'data'    => $leaveRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function resubmit(Request $request, LeaveRequest $leaveRequest): JsonResponse
    {
        abort_unless($leaveRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->resubmit($leaveRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Leave request resubmitted.',
            'data'    => $leaveRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function certificate(LeaveRequest $leaveRequest): JsonResponse
    {
        abort_unless($leaveRequest->isApproved(), 403, 'Certificate only available for approved requests.');
        return response()->json([
            'data' => $leaveRequest->load([
                'requester.department',
                'approvalRequest.history.user',
                'approvalRequest.workflow.steps',
            ]),
        ]);
    }
}
