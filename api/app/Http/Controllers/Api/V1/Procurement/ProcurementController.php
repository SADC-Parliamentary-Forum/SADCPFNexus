<?php
namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementRequest;
use App\Modules\Procurement\Services\ProcurementService;
use App\Services\WorkflowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementController extends Controller
{
    public function __construct(
        private readonly ProcurementService $procurementService,
        private readonly WorkflowService    $workflowService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $filters = $request->only(['status', 'category', 'search', 'per_page']);
        return response()->json($this->procurementService->list($filters, $request->user()));
    }

    public function show(ProcurementRequest $procurementRequest): JsonResponse
    {
        $procurementRequest = ProcurementRequest::where('id', $procurementRequest->id)
            ->where('tenant_id', request()->user()->tenant_id)
            ->firstOrFail();
        if ((int) $procurementRequest->tenant_id !== (int) request()->user()->tenant_id) {
            abort(404);
        }
        return response()->json($procurementRequest->load([
            'requester',
            'approver',
            'items',
            'quotes.vendor',
            'quotes.assessor',
            'supplierCategories',
            'purchaseOrder.vendor',
            'purchaseOrder.items',
            'rfqInvitations.vendor',
            'rfqInvitations.quote',
            'approvalRequest.workflow.steps',
            'approvalRequest.history.user',
        ]));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'title'              => ['required', 'string', 'max:300'],
            'description'        => ['required', 'string', 'max:2000'],
            'category'           => ['required', 'string', 'in:goods,services,works'],
            'estimated_value'    => ['nullable', 'numeric', 'min:0'],
            'currency'           => ['nullable', 'string', 'size:3'],
            'procurement_method' => ['nullable', 'string', 'in:quotation,tender,direct'],
            'budget_line'        => ['nullable', 'string', 'max:200'],
            'justification'      => ['nullable', 'string', 'max:2000'],
            'required_by_date'   => ['nullable', 'date'],
            'items'              => ['nullable', 'array'],
            'items.*.description'          => ['required_with:items', 'string'],
            'items.*.quantity'             => ['nullable', 'integer', 'min:1'],
            'items.*.unit'                 => ['nullable', 'string'],
            'items.*.estimated_unit_price' => ['nullable', 'numeric', 'min:0'],
        ]);

        $procurement = $this->procurementService->create($data, $request->user());
        return response()->json(['message' => 'Procurement request created.', 'data' => $procurement], 201);
    }

    public function update(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $data = $request->validate([
            'title'            => ['sometimes', 'string', 'max:300'],
            'description'      => ['sometimes', 'string', 'max:2000'],
            'category'         => ['sometimes', 'string', 'in:goods,services,works'],
            'estimated_value'  => ['nullable', 'numeric', 'min:0'],
            'budget_line'      => ['nullable', 'string'],
            'justification'    => ['nullable', 'string'],
            'required_by_date' => ['nullable', 'date'],
        ]);

        $procurement = $this->procurementService->update($procurementRequest, $data, $request->user());
        return response()->json(['message' => 'Procurement request updated.', 'data' => $procurement]);
    }

    public function destroy(ProcurementRequest $procurementRequest): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) request()->user()->tenant_id) {
            abort(404);
        }
        if ((int) $procurementRequest->requester_id !== (int) request()->user()->id) {
            abort(403);
        }
        if (!$procurementRequest->isDraft()) {
            return response()->json(['message' => 'Only draft requests can be deleted.'], 422);
        }
        $procurementRequest->forceDelete();
        return response()->json(['message' => 'Procurement request deleted.']);
    }

    public function submit(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $procurement = $this->procurementService->submit($procurementRequest, $request->user());
        return response()->json(['message' => 'Procurement request submitted.', 'data' => $procurement]);
    }

    public function hodApprove(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['HOD', 'System Admin', 'super-admin'])) {
            abort(403);
        }
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $procurement = $this->procurementService->hodApprove($procurementRequest, $request->user());
        return response()->json(['message' => 'HOD approval recorded.', 'data' => $procurement]);
    }

    public function hodReject(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['HOD', 'System Admin', 'super-admin'])) {
            abort(403);
        }
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);
        $procurement = $this->procurementService->hodReject($procurementRequest, $data['reason'], $request->user());
        return response()->json(['message' => 'HOD rejection recorded.', 'data' => $procurement]);
    }

    public function approve(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        if ($procurementRequest->approvalRequest) {
            $data   = $request->validate(['comment' => ['nullable', 'string', 'max:1000']]);
            $result = $this->workflowService->approve(
                $procurementRequest->approvalRequest,
                $request->user(),
                $data['comment'] ?? null
            );
            return response()->json([
                'message'            => 'Procurement request approved.',
                'data'               => $procurementRequest->fresh(['requester', 'approver', 'approvalRequest']),
                'notified_approvers' => $result['notified_approvers'],
            ]);
        }

        if ($request->user()->hasRole('staff')) {
            abort(403);
        }
        $procurement = $this->procurementService->approve($procurementRequest, $request->user());
        return response()->json(['message' => 'Procurement request approved.', 'data' => $procurement]);
    }

    public function award(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Secretary General', 'System Admin'])) {
            abort(403);
        }
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate([
            'quote_id'    => ['required', 'integer'],
            'award_notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $procurement = $this->procurementService->award(
            $procurementRequest,
            $data['quote_id'],
            $data['award_notes'] ?? null,
            $request->user()
        );

        return response()->json(['message' => 'Contract awarded successfully.', 'data' => $procurement]);
    }

    public function issueRfq(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if (
            !$request->user()->isSystemAdmin()
            && !$request->user()->hasAnyPermission(['procurement.create', 'procurement.approve', 'procurement.admin'])
        ) {
            abort(403);
        }

        $data = $request->validate([
            'rfq_deadline' => ['nullable', 'date'],
            'rfq_notes'    => ['nullable', 'string', 'max:2000'],
            'category_ids' => ['required', 'array', 'min:1', 'max:3'],
            'category_ids.*' => ['integer', 'exists:supplier_categories,id'],
            'external_invites' => ['nullable', 'array'],
            'external_invites.*.name' => ['nullable', 'string', 'max:255'],
            'external_invites.*.email' => ['required_with:external_invites', 'email', 'max:255'],
        ]);

        $rfq = $this->procurementService->issueRfq($procurementRequest, $data, $request->user());
        return response()->json(['message' => 'RFQ issued.', 'data' => $rfq]);
    }

    public function reject(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        if ($request->user()->hasRole('staff')) {
            abort(403);
        }
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:1000'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);
        $reason = $data['reason'] ?? $data['comment'] ?? null;
        if (!$reason) {
            return response()->json([
                'message' => 'The comment field is required.',
                'errors' => ['comment' => ['The comment field is required.']],
            ], 422);
        }
        if ($procurementRequest->approvalRequest) {
            $this->workflowService->reject($procurementRequest->approvalRequest, $request->user(), $reason);
            return response()->json([
                'message' => 'Procurement request rejected.',
                'data'    => $procurementRequest->fresh(['requester', 'approver', 'approvalRequest']),
            ]);
        }

        $procurement = $this->procurementService->reject($procurementRequest, $reason, $request->user());
        return response()->json(['message' => 'Procurement request rejected.', 'data' => $procurement]);
    }

    public function returnForCorrection(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        $data = $request->validate(['comment' => ['required', 'string', 'max:1000']]);
        abort_unless($procurementRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->returnForCorrection(
            $procurementRequest->approvalRequest,
            $request->user(),
            $data['comment']
        );
        return response()->json([
            'message' => 'Request returned to requester for correction.',
            'data'    => $procurementRequest->fresh(['requester', 'approver', 'approvalRequest']),
        ]);
    }

    public function withdraw(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        abort_unless($procurementRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->withdraw($procurementRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Procurement request withdrawn.',
            'data'    => $procurementRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function resubmit(Request $request, ProcurementRequest $procurementRequest): JsonResponse
    {
        abort_unless($procurementRequest->approvalRequest, 422, 'No active workflow on this request.');
        $this->workflowService->resubmit($procurementRequest->approvalRequest, $request->user());
        return response()->json([
            'message' => 'Procurement request resubmitted.',
            'data'    => $procurementRequest->fresh(['requester', 'approvalRequest']),
        ]);
    }

    public function certificate(ProcurementRequest $procurementRequest): JsonResponse
    {
        abort_unless($procurementRequest->isApproved(), 403, 'Certificate only available for approved requests.');
        return response()->json([
            'data' => $procurementRequest->load([
                'requester.department',
                'approvalRequest.history.user',
                'approvalRequest.workflow.steps',
            ]),
        ]);
    }
}
