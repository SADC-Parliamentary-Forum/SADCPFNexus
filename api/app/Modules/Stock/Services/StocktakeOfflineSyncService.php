<?php

namespace App\Modules\Stock\Services;

use App\Models\StockItem;
use App\Models\Stocktake;
use App\Models\StocktakeLine;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class StocktakeOfflineSyncService
{
    public function __construct(private readonly StocktakeService $stocktakeService) {}

    /**
     * Apply an offline stocktake queue to a draft/in-progress stocktake.
     *
     * @param  array<int, array{
     *   client_line_key?: string|null,
     *   stock_item_id?: int|null,
     *   barcode?: string|null,
     *   counted_qty: int|float|string|null,
     *   notes?: string|null
     * }>  $lines
     * @return array{applied: array, conflicts: array, skipped: array, stocktake: Stocktake}
     */
    public function sync(Stocktake $stocktake, array $lines, User $user, bool $force = false): array
    {
        if ((int) $stocktake->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! $stocktake->isEditable()) {
            throw ValidationException::withMessages([
                'status' => 'Only draft or in-progress stocktakes accept offline sync.',
            ]);
        }

        $applied = [];
        $conflicts = [];
        $skipped = [];

        DB::transaction(function () use ($stocktake, $lines, $user, $force, &$applied, &$conflicts, &$skipped) {
            $stocktake->load('lines.item');

            foreach ($lines as $idx => $payload) {
                $clientKey = isset($payload['client_line_key']) ? trim((string) $payload['client_line_key']) : '';
                $counted = array_key_exists('counted_qty', $payload) ? $payload['counted_qty'] : null;
                if ($counted === null || $counted === '') {
                    $skipped[] = ['index' => $idx, 'reason' => 'missing_counted_qty', 'client_line_key' => $clientKey ?: null];
                    continue;
                }
                $countedQty = (int) $counted;

                $line = $this->resolveLine($stocktake, $payload, $clientKey);
                if (! $line) {
                    $skipped[] = [
                        'index' => $idx,
                        'reason' => 'line_not_found',
                        'client_line_key' => $clientKey ?: null,
                        'barcode' => $payload['barcode'] ?? null,
                        'stock_item_id' => $payload['stock_item_id'] ?? null,
                    ];
                    continue;
                }

                $serverQty = $line->counted_qty;
                if ($serverQty !== null && (int) $serverQty !== $countedQty && ! $force) {
                    $conflicts[] = [
                        'client_line_key' => $clientKey !== '' ? $clientKey : ($line->client_line_key ?: null),
                        'line_id' => $line->id,
                        'server_counted_qty' => (int) $serverQty,
                        'incoming_counted_qty' => $countedQty,
                    ];
                    continue;
                }

                $line->counted_qty = $countedQty;
                $line->variance = $countedQty - (int) $line->system_qty;
                if (array_key_exists('notes', $payload)) {
                    $line->notes = $payload['notes'];
                }
                if ($clientKey !== '') {
                    $line->client_line_key = $clientKey;
                }
                $line->save();

                $applied[] = [
                    'line_id' => $line->id,
                    'client_line_key' => $line->client_line_key,
                    'counted_qty' => $countedQty,
                ];
            }

            if ($stocktake->status === Stocktake::STATUS_DRAFT && count($applied) > 0) {
                $stocktake->update(['status' => Stocktake::STATUS_IN_PROGRESS]);
            }
        });

        return [
            'applied' => $applied,
            'conflicts' => $conflicts,
            'skipped' => $skipped,
            'stocktake' => $this->stocktakeService->present(
                $stocktake->fresh(['lines.item', 'location', 'creator']),
                $user
            ),
        ];
    }

    /**
     * @param  array{stock_item_id?: int|null, barcode?: string|null}  $payload
     */
    private function resolveLine(Stocktake $stocktake, array $payload, string $clientKey): ?StocktakeLine
    {
        if ($clientKey !== '') {
            $byKey = $stocktake->lines->first(
                fn (StocktakeLine $l) => (string) $l->client_line_key === $clientKey
            );
            if ($byKey) {
                return $byKey;
            }
        }

        $itemId = isset($payload['stock_item_id']) ? (int) $payload['stock_item_id'] : 0;
        if ($itemId > 0) {
            $byItem = $stocktake->lines->first(
                fn (StocktakeLine $l) => (int) $l->stock_item_id === $itemId
            );
            if ($byItem) {
                return $byItem;
            }
        }

        $barcode = isset($payload['barcode']) ? trim((string) $payload['barcode']) : '';
        if ($barcode !== '') {
            $item = StockItem::query()
                ->where('tenant_id', $stocktake->tenant_id)
                ->where('barcode', $barcode)
                ->first();
            if ($item) {
                return $stocktake->lines->first(
                    fn (StocktakeLine $l) => (int) $l->stock_item_id === (int) $item->id
                );
            }
        }

        return null;
    }
}
