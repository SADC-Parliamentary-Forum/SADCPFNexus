<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Modules\Procurement\Services\PurchaseOrderService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PurchaseOrderController extends Controller
{
    public function __construct(private readonly PurchaseOrderService $service) {}

    public function index(Request $request): JsonResponse
    {
        if ($request->user()->hasRole('staff')) {
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
            'data' => $purchaseOrder->load(['vendor', 'items', 'procurementRequest', 'goodsReceiptNotes', 'createdBy']),
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
}
