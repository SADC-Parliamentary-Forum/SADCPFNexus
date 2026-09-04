<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProcurementDocumentIntake;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Modules\Procurement\Services\FinanceHandoverService;
use App\Modules\Procurement\Services\LpoIssuanceService;
use App\Modules\Procurement\Services\LpoPdfService;
use App\Modules\Procurement\Services\PurchaseOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class PurchaseOrderController extends Controller
{
    public function __construct(
        private readonly PurchaseOrderService $service,
        private readonly LpoIssuanceService $lpo,
        private readonly LpoPdfService $pdf,
        private readonly FinanceHandoverService $finance,
    ) {}

    public function index(Request $request): JsonResponse
    {
        if ($request->user()->hasAnyRole(['staff', 'Staff', 'General Employee'])) {
            abort(403);
        }
        $filters = $request->only(['status', 'search', 'per_page']);
        return response()->json($this->service->list($filters, $request->user()));
    }

    public function show(PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ((int) $purchaseOrder->tenant_id !== (int) request()->user()->tenant_id) {
            abort(404);
        }
        if (request()->user()->isSupplier() && (int) request()->user()->vendor_id !== (int) $purchaseOrder->vendor_id) {
            abort(404);
        }
        return response()->json([
            'data' => $purchaseOrder->load([
                'vendor', 'items', 'procurementRequest.requester', 'goodsReceiptNotes',
                'createdBy', 'project', 'sourceIntake.lines', 'serviceConfirmations.confirmedBy',
                'approvalRequest',
            ]),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'procurement_request_id' => ['required', 'integer', 'exists:procurement_requests,id'],
            'vendor_id'              => ['required', 'integer', 'exists:vendors,id'],
            'title'                  => ['required', 'string', 'max:300'],
            'description'            => ['nullable', 'string'],
            'delivery_address'       => ['nullable', 'string', 'max:500'],
            'payment_terms'          => ['nullable', 'string', 'in:net_30,net_60,on_delivery'],
            'total_amount'           => ['nullable', 'numeric', 'min:0'],
            'currency'               => ['nullable', 'string', 'size:3'],
            'expected_delivery_date' => ['nullable', 'date'],
            'items'                  => ['nullable', 'array'],
            'items.*.description'    => ['required_with:items', 'string'],
            'items.*.quantity'       => ['required_with:items', 'integer', 'min:1'],
            'items.*.unit'           => ['nullable', 'string'],
            'items.*.unit_price'     => ['required_with:items', 'numeric', 'min:0'],
            'items.*.total_price'    => ['nullable', 'numeric', 'min:0'],
        ]);

        $req = ProcurementRequest::where('id', $data['procurement_request_id'])
            ->where('tenant_id', $request->user()->tenant_id)
            ->firstOrFail();

        $po = $this->service->create($req, $data, $request->user());
        return response()->json(['message' => 'Purchase order created.', 'data' => $po], 201);
    }

    public function update(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'title'                  => ['sometimes', 'string', 'max:300'],
            'description'            => ['nullable', 'string'],
            'delivery_address'       => ['nullable', 'string'],
            'payment_terms'          => ['nullable', 'in:net_30,net_60,on_delivery'],
            'expected_delivery_date' => ['nullable', 'date'],
        ]);

        $po = $this->service->update($purchaseOrder, $data, $request->user());
        return response()->json(['message' => 'Purchase order updated.', 'data' => $po]);
    }

    public function issue(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $po = $this->service->issue($purchaseOrder, $request->user());
        return response()->json(['message' => 'Purchase order issued.', 'data' => $po]);
    }

    public function cancel(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $po = $this->service->cancel($purchaseOrder, $data['reason'], $request->user());
        return response()->json(['message' => 'Purchase order cancelled.', 'data' => $po]);
    }

    public function generateFromIntake(Request $request, ProcurementDocumentIntake $intake): JsonResponse
    {
        $this->assertCanManage($request);
        if ((int) $intake->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $data = $request->validate([
            'title' => ['nullable', 'string', 'max:300'],
            'description' => ['nullable', 'string'],
            'idempotency_key' => ['nullable', 'string', 'max:80'],
            'accept_arithmetic_exception' => ['nullable', 'boolean'],
        ]);
        $po = $this->lpo->createDraftFromIntake($intake, $request->user(), $data);

        return response()->json(['message' => 'LPO draft created.', 'data' => $po], 201);
    }

    public function submit(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertCanManage($request);
        $this->assertTenant($request, $purchaseOrder);
        $po = $this->lpo->submit($purchaseOrder, $request->user(), $request->input('idempotency_key'));

        return response()->json(['message' => 'LPO sent for approval.', 'data' => $po]);
    }

    public function approve(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate(['comment' => ['nullable', 'string'], 'idempotency_key' => ['nullable', 'string']]);
        $po = $this->lpo->approve($purchaseOrder, $request->user(), $data['comment'] ?? null, $data['idempotency_key'] ?? null);

        return response()->json(['message' => 'LPO approved.', 'data' => $po]);
    }

    public function returnLpo(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate(['comment' => ['required', 'string', 'max:2000']]);
        $po = $this->lpo->returnForCorrection($purchaseOrder, $request->user(), $data['comment']);

        return response()->json(['message' => 'LPO returned for correction.', 'data' => $po]);
    }

    public function reject(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000'], 'idempotency_key' => ['nullable', 'string']]);
        $po = $this->lpo->reject($purchaseOrder, $request->user(), $data['reason'], $data['idempotency_key'] ?? null);

        return response()->json(['message' => 'LPO rejected.', 'data' => $po]);
    }

    public function pdf(Request $request, PurchaseOrder $purchaseOrder): Response
    {
        $this->assertTenant($request, $purchaseOrder);
        if ($request->user()->isSupplier() && (int) $request->user()->vendor_id !== (int) $purchaseOrder->vendor_id) {
            abort(404);
        }
        $binary = $this->pdf->output($purchaseOrder);
        AuditLog::record('procurement.lpo_downloaded', [
            'auditable_type' => PurchaseOrder::class,
            'auditable_id' => $purchaseOrder->id,
            'tags' => 'procurement',
        ]);

        return response($binary, 200, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'attachment; filename="'.$this->pdf->filename($purchaseOrder).'"',
        ]);
    }

    public function email(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertCanManage($request);
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate([
            'to' => ['nullable', 'email'],
            'idempotency_key' => ['nullable', 'string'],
        ]);
        $po = $this->lpo->emailSupplier($purchaseOrder, $request->user(), $data['to'] ?? null, $data['idempotency_key'] ?? null);

        return response()->json(['message' => 'Supplier email queued.', 'data' => $po]);
    }

    public function serviceConfirmation(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate([
            'delivered' => ['required', 'in:yes,no,partially'],
            'satisfactory' => ['nullable', 'boolean'],
            'comments' => ['nullable', 'string'],
        ]);
        $row = $this->finance->confirmService($purchaseOrder, $request->user(), $data);

        return response()->json(['message' => 'Service confirmation recorded.', 'data' => $row], 201);
    }

    public function invoiceMatch(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertCanManage($request);
        $this->assertTenant($request, $purchaseOrder);

        return response()->json(['data' => $this->finance->match($purchaseOrder)]);
    }

    public function financeHandover(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        $this->assertTenant($request, $purchaseOrder);
        $po = $this->finance->sendToFinance($purchaseOrder, $request->user(), $request->input('idempotency_key'));

        return response()->json(['message' => 'Payment pack sent to Finance.', 'data' => $po]);
    }

    public function void(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertCanManage($request);
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate(['reason' => ['required', 'string', 'max:2000']]);
        $po = $this->lpo->void($purchaseOrder, $request->user(), $data['reason']);

        return response()->json(['message' => 'LPO voided. Number will not be reused.', 'data' => $po]);
    }

    public function amend(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        $this->assertCanManage($request);
        $this->assertTenant($request, $purchaseOrder);
        $data = $request->validate([
            'reason' => ['required', 'string', 'max:2000'],
        ]);
        $po = $this->lpo->amend($purchaseOrder, $request->user(), $data);

        return response()->json(['message' => 'LPO opened for amendment.', 'data' => $po]);
    }

    private function assertCanManage(Request $request): void
    {
        if (! $request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
    }

    private function assertTenant(Request $request, PurchaseOrder $purchaseOrder): void
    {
        if ((int) $purchaseOrder->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
    }
}
