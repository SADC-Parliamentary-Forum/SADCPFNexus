<?php
namespace App\Http\Controllers\Api\V1\Imprest;

use App\Http\Controllers\Controller;
use App\Models\ImprestRequest;
use App\Modules\Imprest\Services\ImprestService;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ImprestController extends Controller
{
    public function __construct(
        private readonly ImprestService $imprestService,
        private readonly WorkflowService $workflowService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'per_page']);
        return response()->json($this->imprestService->list($filters, $request->user()));
    }

    public function show(ImprestRequest $imprestRequest): JsonResponse
    {
        return response()->json($imprestRequest->load([
            'requester', 'approver',
            'approvalRequest.workflow.steps',
            'approvalRequest.history.user',
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'budget_line'               => ['required', 'string', 'max:200'],
            'amount_requested'          => ['required', 'numeric', 'min:1'],
            'currency'                  => ['nullable', 'string', 'size:3'],
            'expected_liquidation_date' => ['required', 'date', 'after:today'],
            'purpose'                   => ['required', 'string', 'max:2000'],
            'justification'             => ['nullable', 'string', 'max:2000'],
        ]);

        $imprest = $this->imprestService->create($data, $request->user());
        return response()->json(['message' => 'Imprest request created.', 'data' => $imprest], 201);
    }

    public function update(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate([
            'budget_line'               => ['sometimes', 'string', 'max:200'],
            'amount_requested'          => ['sometimes', 'numeric', 'min:1'],
            'expected_liquidation_date' => ['sometimes', 'date'],
            'purpose'                   => ['sometimes', 'string', 'max:2000'],
            'justification'             => ['nullable', 'string', 'max:2000'],
        ]);

        $imprest = $this->imprestService->update($imprestRequest, $data, $request->user());
        return response()->json(['message' => 'Imprest request updated.', 'data' => $imprest]);
    }

    public function destroy(ImprestRequest $imprestRequest): JsonResponse
    {
        if (!$imprestRequest->isDraft()) {
            return response()->json(['message' => 'Only draft requests can be deleted.'], 422);
        }
        $imprestRequest->delete();
        return response()->json(['message' => 'Imprest request deleted.']);
    }

    public function submit(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $imprest = $this->imprestService->submit($imprestRequest, $request->user());
        return response()->json(['message' => 'Imprest request submitted.', 'data' => $imprest]);
    }

    public function approve(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        if ($imprestRequest->approvalRequest) {
            $data = $request->validate(['comment' => ['nullable', 'string', 'max:1000']]);
            $result = $this->workflowService->approve(
                $imprestRequest->approvalRequest,
                $request->user(),
                $data['comment'] ?? null
            );
            return response()->json([
                'message'            => 'Imprest request approved.',
                'data'               => $imprestRequest->fresh(['requester', 'approver', 'approvalRequest']),
                'notified_approvers' => $result['notified_approvers'],
            ]);
        }

        $data = $request->validate(['amount_approved' => ['nullable', 'numeric', 'min:0']]);
        $imprest = $this->imprestService->approve($imprestRequest, $data, $request->user());
        return response()->json(['message' => 'Imprest request approved.', 'data' => $imprest]);
    }

    public function reject(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);

        if ($imprestRequest->approvalRequest) {
            $this->workflowService->reject($imprestRequest->approvalRequest, $request->user(), $data['reason']);
            return response()->json([
                'message' => 'Imprest request rejected.',
                'data'    => $imprestRequest->fresh(['requester', 'approver', 'approvalRequest']),
            ]);
        }

        $imprest = $this->imprestService->reject($imprestRequest, $data['reason'], $request->user());
        return response()->json(['message' => 'Imprest request rejected.', 'data' => $imprest]);
    }

    public function returnForCorrection(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']]);
        abort_unless($imprestRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->returnForCorrection(
            $imprestRequest->approvalRequest,
            $request->user(),
            $data['comment']
        );
        return response()->json([
            'message' => 'Request returned to requester for correction.',
            'data'    => $imprestRequest->fresh(['requester', 'approver', 'approvalRequest']),
        ]);
    }

    public function withdraw(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        abort_unless($imprestRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->withdraw($imprestRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Imprest request withdrawn.',
            'data'    => $imprestRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function resubmit(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        abort_unless($imprestRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->resubmit($imprestRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Imprest request resubmitted.',
            'data'    => $imprestRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function retire(Request $request, ImprestRequest $imprestRequest): JsonResponse
    {
        $data = $request->validate([
            'amount_liquidated'  => ['required', 'numeric', 'min:0'],
            'notes'              => ['nullable', 'string', 'max:2000'],
            'receipts_attached'  => ['nullable', 'boolean'],
        ]);
        $imprest = $this->imprestService->retire($imprestRequest, $data, $request->user());
        return response()->json(['message' => 'Imprest request retired successfully.', 'data' => $imprest]);
    }

    public function certificate(ImprestRequest $imprestRequest): JsonResponse
    {
        abort_unless($imprestRequest->isApproved(), 403, 'Certificate only available for approved requests.');
        return response()->json([
            'data' => $imprestRequest->load([
                'requester.department',
                'approvalRequest.history.user',
                'approvalRequest.workflow.steps',
            ]),
        ]);
    }
}
