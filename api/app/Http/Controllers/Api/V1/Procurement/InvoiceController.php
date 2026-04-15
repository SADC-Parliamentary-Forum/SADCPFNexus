<?php

namespace App\Http\Controllers\Api\V1\Procurement;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use App\Modules\Procurement\Services\InvoiceService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class InvoiceController extends Controller
{
    public function __construct(private readonly InvoiceService $service) {}

    public function index(Request $request): JsonResponse
    {
        $items = $this->service->list(
            $request->only(['status']),
            $request->user()
        );
        return response()->json(['data' => $items]);
    }

    public function show(Request $request, Invoice $invoice): JsonResponse
    {
        if ((int) $invoice->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }
        if ($request->user()->isSupplier() && (int) $request->user()->vendor_id !== (int) $invoice->vendor_id) {
            abort(404);
        }
        return response()->json([
            'data' => $invoice->load(['vendor', 'purchaseOrder.vendor', 'goodsReceiptNote', 'reviewedBy']),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Finance Controller', 'Procurement Officer', 'System Admin', 'Secretary General'])) {
            abort(403);
        }

        $data = $request->validate([
            'purchase_order_id'     => ['required', 'integer', 'exists:purchase_orders,id'],
            'goods_receipt_note_id' => ['nullable', 'integer', 'exists:goods_receipt_notes,id'],
            'vendor_id'             => ['required', 'integer', 'exists:vendors,id'],
            'vendor_invoice_number' => ['required', 'string', 'max:100', 'unique:invoices,vendor_invoice_number'],
            'invoice_date'          => ['required', 'date'],
            'due_date'              => ['required', 'date', 'after_or_equal:invoice_date'],
            'amount'                => ['required', 'numeric', 'min:0.01'],
            'currency'              => ['nullable', 'string', 'max:10'],
        ]);

        // Amount vs PO total validation (returns 422 with field error)
        $po = \App\Models\PurchaseOrder::find($data['purchase_order_id']);
        if ($po && (float) $data['amount'] > (float) $po->total_amount) {
            throw \Illuminate\Validation\ValidationException::withMessages([
                'amount' => ["Invoice amount cannot exceed PO total of {$po->currency} {$po->total_amount}."],
            ]);
        }

        try {
            $invoice = $this->service->create($data, $request->user());
            return response()->json(['message' => 'Invoice recorded.', 'data' => $invoice], 201);
        } catch (\InvalidArgumentException $e) {
            throw \Illuminate\Validation\ValidationException::withMessages(['amount' => [$e->getMessage()]]);
        }
    }

    public function approve(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $invoice->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $inv = $this->service->approve($invoice, $request->user());
        return response()->json(['message' => 'Invoice approved for payment.', 'data' => $inv]);
    }

    public function reject(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $invoice->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $data = $request->validate(['reason' => ['required', 'string', 'max:1000']]);
        $inv  = $this->service->reject($invoice, $data['reason'], $request->user());
        return response()->json(['message' => 'Invoice rejected.', 'data' => $inv]);
    }

    public function markPaid(Request $request, Invoice $invoice): JsonResponse
    {
        if (! $request->user()->hasAnyRole(['Finance Controller', 'System Admin', 'Secretary General'])) {
            abort(403);
        }
        if ((int) $invoice->tenant_id !== (int) $request->user()->tenant_id) {
            abort(404);
        }

        $inv = $this->service->markPaid($invoice, $request->user());
        return response()->json(['message' => 'Invoice marked as paid.', 'data' => $inv]);
    }
}
