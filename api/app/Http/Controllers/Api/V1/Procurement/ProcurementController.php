<?php
namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementRequest;
use App\Modules\Procurement\Services\ProcurementService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementController extends Controller
{
    public function __construct(private readonly ProcurementService $procurementService) {}

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
        return response()->json($procurementRequest->load(['requester', 'approver', 'items', 'quotes.vendor']));
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
            'quotes'             => ['nullable', 'array'],
            'quotes.*.vendor_name'   => ['required_with:quotes', 'string'],
            'quotes.*.quoted_amount' => ['required_with:quotes', 'numeric', 'min:0'],
            'quotes.*.is_recommended'=> ['nullable', 'boolean'],
            'quotes.*.notes'         => ['nullable', 'string'],
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
        if ($request->user()->hasRole('staff')) {
            abort(403);
        }
        if ((int) $procurementRequest->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
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
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'System Admin', 'super-admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'rfq_deadline' => ['nullable', 'date'],
            'rfq_notes'    => ['nullable', 'string', 'max:2000'],
        ]);

        $procurementRequest->update([
            'rfq_issued_at' => $procurementRequest->rfq_issued_at ?? now(),
            'rfq_deadline'  => $data['rfq_deadline'] ?? null,
            'rfq_notes'     => $data['rfq_notes'] ?? null,
        ]);

        return response()->json(['message' => 'RFQ issued.', 'data' => $procurementRequest->fresh(['requester', 'items', 'quotes'])]);
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
        $procurement = $this->procurementService->reject($procurementRequest, $reason, $request->user());
        return response()->json(['message' => 'Procurement request rejected.', 'data' => $procurement]);
    }
}
