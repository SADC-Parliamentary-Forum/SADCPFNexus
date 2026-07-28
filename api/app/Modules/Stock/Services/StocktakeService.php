<?php

namespace App\Modules\Stock\Services;

use App\Models\AuditLog;
use App\Models\StockItem;
use App\Models\Stocktake;
use App\Models\StocktakeLine;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class StocktakeService
{
    public function __construct(private readonly StockService $stockService) {}

    /**
     * @param  array{
     *     name: string,
     *     count_date: string,
     *     stock_location_id?: int|null,
     *     notes?: string|null,
     *     include_all_active?: bool,
     *     stock_item_ids?: int[]
     * }  $data
     */
    public function create(array $data, User $user): Stocktake
    {
        return DB::transaction(function () use ($data, $user) {
            $stocktake = Stocktake::create([
                'tenant_id'         => $user->tenant_id,
                'reference_number'  => 'STKTK-' . strtoupper(Str::random(8)),
                'name'              => $data['name'],
                'stock_location_id' => $data['stock_location_id'] ?? null,
                'status'            => Stocktake::STATUS_DRAFT,
                'count_date'        => $data['count_date'],
                'notes'             => $data['notes'] ?? null,
                'created_by'        => $user->id,
            ]);

            $query = StockItem::where('tenant_id', $user->tenant_id)->where('status', 'active');
            if (! empty($data['stock_item_ids'])) {
                $query->whereIn('id', $data['stock_item_ids']);
            } elseif (! empty($data['stock_location_id'])) {
                $query->where('stock_location_id', $data['stock_location_id']);
            } elseif (empty($data['include_all_active'])) {
                throw ValidationException::withMessages([
                    'stock_item_ids' => 'Provide stock_item_ids, a stock_location_id, or include_all_active=true.',
                ]);
            }

            $items = $query->orderBy('name')->get();
            if ($items->isEmpty()) {
                throw ValidationException::withMessages([
                    'stock_item_ids' => 'No active stock items match this stocktake scope.',
                ]);
            }

            foreach ($items as $item) {
                StocktakeLine::create([
                    'stocktake_id'  => $stocktake->id,
                    'stock_item_id' => $item->id,
                    'system_qty'    => $item->current_balance,
                    'counted_qty'   => null,
                    'variance'      => null,
                ]);
            }

            AuditLog::record('stock.stocktake_created', [
                'auditable_type' => Stocktake::class,
                'auditable_id'   => $stocktake->id,
                'new_values'     => [
                    'reference_number' => $stocktake->reference_number,
                    'lines'            => $items->count(),
                ],
                'tags'           => 'stock',
            ]);

            return $stocktake->fresh(['lines.item', 'location', 'creator']);
        });
    }

    /**
     * @param  array<int, array{id: int, counted_qty: int|null, notes?: string|null}>  $lines
     */
    public function updateCounts(Stocktake $stocktake, array $lines, User $user): Stocktake
    {
        if ((int) $stocktake->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! $stocktake->isEditable()) {
            throw ValidationException::withMessages([
                'status' => 'Only draft or in-progress stocktakes can be updated.',
            ]);
        }

        return DB::transaction(function () use ($stocktake, $lines, $user) {
            foreach ($lines as $payload) {
                /** @var StocktakeLine|null $line */
                $line = $stocktake->lines()->whereKey($payload['id'])->first();
                if (! $line) {
                    throw ValidationException::withMessages([
                        'lines' => "Stocktake line #{$payload['id']} not found.",
                    ]);
                }

                $counted = array_key_exists('counted_qty', $payload) ? $payload['counted_qty'] : $line->counted_qty;
                $line->counted_qty = $counted;
                $line->variance = $counted === null ? null : ((int) $counted - (int) $line->system_qty);
                if (array_key_exists('notes', $payload)) {
                    $line->notes = $payload['notes'];
                }
                $line->save();
            }

            if ($stocktake->status === Stocktake::STATUS_DRAFT) {
                $stocktake->update(['status' => Stocktake::STATUS_IN_PROGRESS]);
            }

            AuditLog::record('stock.stocktake_counts_updated', [
                'auditable_type' => Stocktake::class,
                'auditable_id'   => $stocktake->id,
                'new_values'     => ['updated_lines' => count($lines), 'by' => $user->id],
                'tags'           => 'stock',
            ]);

            return $stocktake->fresh(['lines.item', 'location', 'creator']);
        });
    }

    public function complete(Stocktake $stocktake, User $user): Stocktake
    {
        if ((int) $stocktake->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! $stocktake->isEditable()) {
            throw ValidationException::withMessages([
                'status' => 'This stocktake is already closed.',
            ]);
        }

        $stocktake->load('lines.item');
        $uncounted = $stocktake->lines->whereNull('counted_qty');
        if ($uncounted->isNotEmpty()) {
            throw ValidationException::withMessages([
                'lines' => 'All lines must have a counted quantity before completing the stocktake.',
            ]);
        }

        return DB::transaction(function () use ($stocktake, $user) {
            foreach ($stocktake->lines as $line) {
                $variance = (int) $line->counted_qty - (int) $line->system_qty;
                $line->variance = $variance;
                $line->save();

                if ($variance === 0) {
                    continue;
                }

                $this->stockService->recordTransaction($line->item, [
                    'type'             => StockTransaction::TYPE_ADJUSTMENT,
                    'quantity'         => $variance,
                    'reference'        => $stocktake->reference_number,
                    'reason'           => 'Stocktake variance',
                    'reason_code'      => StockTransaction::REASON_STOCKTAKE,
                    'stock_location_id'=> $stocktake->stock_location_id,
                    'notes'            => $line->notes,
                    'transaction_date' => $stocktake->count_date?->toDateString() ?? now()->toDateString(),
                ], $user);
            }

            $stocktake->update([
                'status'       => Stocktake::STATUS_COMPLETED,
                'completed_by' => $user->id,
                'completed_at' => now(),
            ]);

            AuditLog::record('stock.stocktake_completed', [
                'auditable_type' => Stocktake::class,
                'auditable_id'   => $stocktake->id,
                'new_values'     => ['reference_number' => $stocktake->reference_number],
                'tags'           => 'stock',
            ]);

            return $stocktake->fresh(['lines.item', 'location', 'creator', 'completer']);
        });
    }

    public function cancel(Stocktake $stocktake, User $user): Stocktake
    {
        if ((int) $stocktake->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($stocktake->status === Stocktake::STATUS_COMPLETED) {
            throw ValidationException::withMessages([
                'status' => 'Completed stocktakes cannot be cancelled.',
            ]);
        }

        $stocktake->update(['status' => Stocktake::STATUS_CANCELLED]);

        AuditLog::record('stock.stocktake_cancelled', [
            'auditable_type' => Stocktake::class,
            'auditable_id'   => $stocktake->id,
            'tags'           => 'stock',
        ]);

        return $stocktake->fresh();
    }
}
