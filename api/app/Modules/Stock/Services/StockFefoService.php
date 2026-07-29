<?php

namespace App\Modules\Stock\Services;

use App\Models\StockBatch;
use App\Models\StockItem;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class StockFefoService
{
    /**
     * Allocate quantity across FEFO batches (earliest expiry first).
     *
     * @return list<array{batch: StockBatch, quantity: int}>
     */
    public function allocate(StockItem $item, int $quantity, ?int $explicitBatchId = null): array
    {
        if ($quantity <= 0) {
            throw ValidationException::withMessages(['lines' => 'Issue quantity must be positive.']);
        }

        if ($explicitBatchId) {
            $batch = StockBatch::query()
                ->where('tenant_id', $item->tenant_id)
                ->where('stock_item_id', $item->id)
                ->whereKey($explicitBatchId)
                ->firstOrFail();

            if (! $batch->isIssuable()) {
                throw ValidationException::withMessages([
                    'lines' => "Batch {$batch->batch_number} is not issuable (expired, quarantined, or exhausted).",
                ]);
            }
            if ($batch->quantity < $quantity) {
                throw ValidationException::withMessages([
                    'lines' => "Batch {$batch->batch_number} only has {$batch->quantity} available.",
                ]);
            }

            return [['batch' => $batch, 'quantity' => $quantity]];
        }

        if (! $item->tracks_batches) {
            return [];
        }

        $batches = $this->issuableBatches($item);
        $remaining = $quantity;
        $picks = [];

        foreach ($batches as $batch) {
            if ($remaining <= 0) {
                break;
            }
            $take = min($remaining, (int) $batch->quantity);
            if ($take <= 0) {
                continue;
            }
            $picks[] = ['batch' => $batch, 'quantity' => $take];
            $remaining -= $take;
        }

        if ($remaining > 0) {
            throw ValidationException::withMessages([
                'lines' => "Insufficient batch quantity for FEFO pick on {$item->item_code}: short by {$remaining}.",
            ]);
        }

        return $picks;
    }

    public function decrement(StockBatch $batch, int $quantity): void
    {
        $batch->quantity = max(0, (int) $batch->quantity - $quantity);
        if ($batch->quantity === 0) {
            $batch->status = StockBatch::STATUS_EXHAUSTED;
        }
        $batch->save();
    }

    /**
     * @return Collection<int, StockBatch>
     */
    public function issuableBatches(StockItem $item): Collection
    {
        return StockBatch::query()
            ->where('tenant_id', $item->tenant_id)
            ->where('stock_item_id', $item->id)
            ->where('status', StockBatch::STATUS_ACTIVE)
            ->where('quantity', '>', 0)
            ->where(function ($q) {
                $q->whereNull('expiry_date')->orWhereDate('expiry_date', '>=', now()->toDateString());
            })
            ->orderByRaw('CASE WHEN expiry_date IS NULL THEN 1 ELSE 0 END')
            ->orderBy('expiry_date')
            ->orderBy('id')
            ->lockForUpdate()
            ->get();
    }
}
