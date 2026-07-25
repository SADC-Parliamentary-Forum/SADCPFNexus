<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\GoodsReceiptNote;
use App\Models\PurchaseOrder;
use App\Modules\Procurement\Services\GoodsReceiptService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GoodsReceiptController extends Controller
{
    public function __construct(private readonly GoodsReceiptService $service) {}

    public function indexAll(Request $request): JsonResponse
    {
        $query = GoodsReceiptNote::query()
            ->where('tenant_id', $request->user()->tenant_id)
            ->with(['purchaseOrder.vendor', 'receivedBy'])
            ->orderByDesc('created_at');

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('po_id')) {
            $query->where('purchase_order_id', $request->input('po_id'));
        }

        return response()->json(['data' => $query->get()]);
    }

    public function index(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if ((int) $purchaseOrder->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        $grns = $purchaseOrder->goodsReceiptNotes()
            ->with(['receivedBy', 'items.purchaseOrderItem'])
            ->orderByDesc('created_at')
            ->get();
        return response()->json(['data' => $grns]);
    }

    public function show(Request $request, PurchaseOrder $purchaseOrder, GoodsReceiptNote $receipt): JsonResponse
    {
        if ((int) $purchaseOrder->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        return response()->json([
            'data' => $receipt->load(['receivedBy', 'items.purchaseOrderItem', 'purchaseOrder.vendor']),
        ]);
    }

    public function store(Request $request, PurchaseOrder $purchaseOrder): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'received_date'              => ['required', 'date'],
            'delivery_note_number'       => ['nullable', 'string', 'max:100'],
            'notes'                      => ['nullable', 'string'],
            'items'                      => ['required', 'array', 'min:1'],
            'items.*.purchase_order_item_id' => ['required', 'integer'],
            'items.*.quantity_received'  => ['required', 'integer', 'min:1'],
            'items.*.quantity_accepted'  => ['nullable', 'integer', 'min:0'],
            'items.*.condition_notes'    => ['nullable', 'string'],
        ]);

        $grn = $this->service->record($purchaseOrder, $data, $request->user());
        return response()->json(['message' => 'Goods receipt recorded.', 'data' => $grn], 201);
    }

    public function accept(Request $request, PurchaseOrder $purchaseOrder, GoodsReceiptNote $receipt): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'handoff'                              => ['nullable', 'array'],
            'handoff.*.goods_receipt_item_id'      => ['required_with:handoff', 'integer'],
            'handoff.*.type'                       => ['required_with:handoff', 'string', 'in:fixed_asset,stock'],
            'handoff.*.name'                       => ['required_with:handoff', 'string', 'max:255'],
            'handoff.*.category'                   => ['nullable', 'string', 'max:32'],
            'handoff.*.quantity'                   => ['nullable', 'integer', 'min:1'],
            'handoff.*.unit'                       => ['nullable', 'string', 'max:32'],
            'handoff.*.stock_category_id'          => ['nullable', 'integer', 'exists:stock_categories,id'],
            'handoff.*.notes'                      => ['nullable', 'string', 'max:2000'],
        ]);

        $grn = $this->service->accept($receipt, $request->user(), $data['handoff'] ?? []);
        return response()->json(['message' => 'Goods receipt accepted.', 'data' => $grn]);
    }

    public function reject(Request $request, PurchaseOrder $purchaseOrder, GoodsReceiptNote $receipt): JsonResponse
    {
        if (!$request->user()->hasAnyRole(['Procurement Officer', 'Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $grn  = $this->service->reject($receipt, $data['reason'], $request->user());
        return response()->json(['message' => 'Goods receipt rejected.', 'data' => $grn]);
    }
}
