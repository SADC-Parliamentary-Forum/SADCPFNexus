<?php

namespace App\Modules\Procurement\Services;

use App\Models\Asset;
use App\Models\AuditLog;
use App\Models\GoodsReceiptNote;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Modules\Stock\Services\StockService;
use App\Services\NotificationService;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class GoodsReceiptService
{
    public function __construct(
        protected NotificationService $notificationService,
        protected StockService $stockService,
    ) {}

    public function record(PurchaseOrder $po, array $data, User $user): GoodsReceiptNote
    {
        if ((int) $po->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        if (!$po->canReceiveGoods()) {
            throw ValidationException::withMessages([
                'purchase_order_id' => 'Goods can only be received against an issued purchase order.',
            ]);
        }

        // Validate quantities against PO items
        $po->loadMissing('items.receiptItems');
        foreach ($data['items'] as $lineItem) {
            $poItem = $po->items->find($lineItem['purchase_order_item_id'] ?? null);
            if (!$poItem) {
                throw ValidationException::withMessages([
                    'items' => "Purchase order item #{$lineItem['purchase_order_item_id']} not found on this PO.",
                ]);
            }
            $outstanding = $poItem->outstanding();
            if (($lineItem['quantity_received'] ?? 0) > $outstanding) {
                throw ValidationException::withMessages([
                    'items' => "Cannot receive {$lineItem['quantity_received']} units of \"{$poItem->description}\" â€” only {$outstanding} outstanding.",
                ]);
            }
        }

        $grn = GoodsReceiptNote::create([
            'tenant_id'            => $po->tenant_id,
            'purchase_order_id'    => $po->id,
            'received_by'          => $user->id,
            'received_date'        => $data['received_date'],
            'delivery_note_number' => $data['delivery_note_number'] ?? null,
            'notes'                => $data['notes'] ?? null,
            'status'               => 'pending',
        ]);

        foreach ($data['items'] as $lineItem) {
            $poItem = $po->items->find($lineItem['purchase_order_item_id']);
            $grn->items()->create([
                'purchase_order_item_id' => $poItem->id,
                'quantity_ordered'       => $poItem->quantity,
                'quantity_received'      => $lineItem['quantity_received'] ?? 0,
                'quantity_accepted'      => $lineItem['quantity_accepted'] ?? $lineItem['quantity_received'] ?? 0,
                'condition_notes'        => $lineItem['condition_notes'] ?? null,
            ]);
        }

        // Update PO status
        $this->updatePoStatus($po);

        AuditLog::record('procurement.grn_recorded', [
            'auditable_type' => GoodsReceiptNote::class,
            'auditable_id'   => $grn->id,
            'new_values'     => ['reference' => $grn->reference_number, 'po' => $po->reference_number],
            'tags'           => 'procurement',
        ]);

        return $grn->load(['items.purchaseOrderItem']);
    }

    public function accept(GoodsReceiptNote $grn, User $user, array $handoff = []): GoodsReceiptNote
    {
        if ((int) $grn->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $grn->update(['status' => 'accepted']);

        AuditLog::record('procurement.grn_accepted', [
            'auditable_type' => GoodsReceiptNote::class,
            'auditable_id'   => $grn->id,
            'tags'           => 'procurement',
        ]);

        if (!empty($handoff)) {
            $this->processHandoff($grn, $handoff, $user);
        }

        return $grn->fresh();
    }

    /**
     * @param  array<int, array<string, mixed>>  $handoff
     */
    protected function processHandoff(GoodsReceiptNote $grn, array $handoff, User $user): void
    {
        $grn->loadMissing(['items', 'purchaseOrder.procurementRequest']);

        $po = $grn->purchaseOrder;
        $procurementRequestId = $po?->procurement_request_id;

        foreach ($handoff as $line) {
            $grnItem = $grn->items->find($line['goods_receipt_item_id'] ?? null);
            if (!$grnItem) {
                throw ValidationException::withMessages([
                    'handoff' => "Goods receipt item #{$line['goods_receipt_item_id']} not found on this GRN.",
                ]);
            }

            $type = $line['type'] ?? null;

            if ($type === 'fixed_asset') {
                // One physical unit = one asset record (qty 20 â†’ 20 pending assets).
                $qty = (int) ($line['quantity'] ?? $grnItem->quantity_accepted ?? $grnItem->quantity_received ?? 1);
                if ($qty < 1) {
                    $qty = 1;
                }
                if ($qty > 500) {
                    throw ValidationException::withMessages([
                        'handoff' => 'Fixed-asset handoff quantity cannot exceed 500 per line.',
                    ]);
                }

                $unitCost = isset($line['unit_cost']) ? (float) $line['unit_cost'] : null;
                if ($unitCost === null && $grnItem->purchase_order_item_id) {
                    $poItem = $grn->purchaseOrder?->items?->firstWhere('id', $grnItem->purchase_order_item_id)
                        ?? \App\Models\PurchaseOrderItem::find($grnItem->purchase_order_item_id);
                    if ($poItem && (float) $poItem->quantity > 0) {
                        $unitCost = (float) $poItem->unit_price;
                    }
                }

                for ($i = 1; $i <= $qty; $i++) {
                    $suffix = $qty > 1 ? ' #'.$i : '';
                    Asset::create([
                        'tenant_id'              => $grn->tenant_id,
                        'asset_code'             => 'AST-' . strtoupper(Str::random(8)),
                        'name'                   => $line['name'].$suffix,
                        'category'               => $line['category'] ?? 'equipment',
                        'status'                 => 'pending',
                        'purchase_order_id'      => $grn->purchase_order_id,
                        'procurement_request_id' => $procurementRequestId,
                        'goods_receipt_note_id'  => $grn->id,
                        'purchase_value'         => $unitCost,
                        'currency'               => $po?->currency,
                        'notes'                  => $line['notes'] ?? null,
                    ]);
                }
            } elseif ($type === 'stock') {
                // Consumables only - never create FA records for type=stock.
                $this->stockService->receiveFromGrn($grn, $line, $user, $procurementRequestId);
            } else {
                throw ValidationException::withMessages([
                    'handoff' => 'Each handoff line must specify type fixed_asset or stock.',
                ]);
            }
        }

        AuditLog::record('procurement.grn_handoff', [
            'auditable_type' => GoodsReceiptNote::class,
            'auditable_id'   => $grn->id,
            'new_values'     => ['handoff_count' => count($handoff)],
            'tags'           => 'procurement',
        ]);
    }

    public function reject(GoodsReceiptNote $grn, string $reason, User $user): GoodsReceiptNote
    {
        if ((int) $grn->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $grn->update(['status' => 'rejected', 'notes' => $reason]);

        AuditLog::record('procurement.grn_rejected', [
            'auditable_type' => GoodsReceiptNote::class,
            'auditable_id'   => $grn->id,
            'tags'           => 'procurement',
        ]);

        return $grn->fresh();
    }

    private function updatePoStatus(PurchaseOrder $po): void
    {
        $po->loadMissing('items.receiptItems');

        $allFulfilled = $po->items->every(fn($item) => $item->outstanding() === 0);

        $po->update(['status' => $allFulfilled ? 'received' : 'partially_received']);
    }
}
