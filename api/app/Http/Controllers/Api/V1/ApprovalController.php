<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\ApprovalRequest;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ApprovalController extends Controller
{
    public function __construct(protected WorkflowService $workflowService) {}

    /**
     * Get pending approvals for the current user.
     */
    public function pending(Request $request): JsonResponse
    {
        $user = $request->user();

        // This is a bit complex because approvers are dynamic
        // For now, we'll list all pending requests and filter in PHP or use a more optimized query later
        $pending = ApprovalRequest::where('status', 'pending')
            ->where('tenant_id', $user->tenant_id)
            ->with(['approvable', 'workflow.steps.role', 'workflow.steps.user'])
            ->get();

        $myApprovals = $pending->filter(function ($request) use ($user) {
            $approvers = $this->workflowService->getCurrentApprovers($request);
            return collect($approvers)->contains('id', $user->id) || $user->isSystemAdmin();
        });

        return response()->json(['data' => $myApprovals->values()]);
    }

    /**
     * Approve a request.
     */
    public function approve(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $data = $request->validate([
            'comment' => ['nullable', 'string', 'max:1000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $result = $this->workflowService->approve(
            $approvalRequest,
            $request->user(),
            $data['comment'] ?? null,
            $data['idempotency_key'] ?? $request->header('Idempotency-Key')
        );

        return response()->json(['message' => 'Request approved.', 'data' => $result]);
    }

    /**
     * Reject a request.
     */
    public function reject(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $data = $request->validate([
            'comment' => ['required', 'string', 'max:1000'],
            'idempotency_key' => ['nullable', 'string', 'max:128'],
        ]);

        $this->workflowService->reject(
            $approvalRequest,
            $request->user(),
            $data['comment'],
            $data['idempotency_key'] ?? $request->header('Idempotency-Key')
        );

        return response()->json(['message' => 'Request rejected.']);
    }

    /**
     * Get history for a specific request.
     */
    public function history(ApprovalRequest $approvalRequest): JsonResponse
    {
        return response()->json(['data' => $approvalRequest->history()->with('user')->get()]);
    }

    /**
     * WS1 — Rich workflow visibility snapshot (current stage, who holds it,
     * prepared-by/on-behalf-of, next step, full history with per-step status).
     */
    public function snapshot(Request $request, ApprovalRequest $approvalRequest): JsonResponse
    {
        $user = $request->user();
        abort_unless((int) $approvalRequest->tenant_id === (int) $user->tenant_id, 404);

        return response()->json(['data' => $this->workflowService->snapshot($approvalRequest)]);
    }
}
