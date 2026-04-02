<?php

namespace App\Modules\Procurement\Services;

use App\Models\AuditLog;
use App\Models\GoodsReceiptNote;
use App\Models\PurchaseOrder;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Validation\ValidationException;

class GoodsReceiptService
{
    public function __construct(protected NotificationService $notificationService) {}

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
                    'items' => "Cannot receive {$lineItem['quantity_received']} units of \"{$poItem->description}\" — only {$outstanding} outstanding.",
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

    public function accept(GoodsReceiptNote $grn, User $user): GoodsReceiptNote
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

        return $grn->fresh();
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
