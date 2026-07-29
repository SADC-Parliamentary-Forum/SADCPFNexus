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
     *     is_blind?: bool,
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
                'is_blind'          => (bool) ($data['is_blind'] ?? false),
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
                    'is_blind'         => $stocktake->is_blind,
                ],
                'tags'           => 'stock',
            ]);

            return $this->present($stocktake->fresh(['lines.item', 'location', 'creator']), $user);
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
                if (! empty($payload['client_line_key'])) {
                    $line->client_line_key = (string) $payload['client_line_key'];
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

            return $this->present($stocktake->fresh(['lines.item', 'location', 'creator']), $user);
        });
    }

    /**
     * Submit for completion. Zero-variance completes immediately; any variance
     * requires approval before ledger adjustments are posted.
     */
    public function complete(Stocktake $stocktake, User $user): Stocktake
    {
        if ((int) $stocktake->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if (! $stocktake->isEditable()) {
            throw ValidationException::withMessages([
                'status' => 'This stocktake is already closed or awaiting approval.',
            ]);
        }

        $stocktake->load('lines.item');
        $uncounted = $stocktake->lines->whereNull('counted_qty');
        if ($uncounted->isNotEmpty()) {
            throw ValidationException::withMessages([
                'lines' => 'All lines must have a counted quantity before completing the stocktake.',
            ]);
        }

        foreach ($stocktake->lines as $line) {
            $line->variance = (int) $line->counted_qty - (int) $line->system_qty;
            $line->save();
        }

        $hasVariance = $stocktake->lines->contains(fn (StocktakeLine $l) => (int) $l->variance !== 0);

        if ($hasVariance) {
            $stocktake->update(['status' => Stocktake::STATUS_PENDING_APPROVAL]);
            AuditLog::record('stock.stocktake_pending_approval', [
                'auditable_type' => Stocktake::class,
                'auditable_id'   => $stocktake->id,
                'tags'           => 'stock',
            ]);

            return $this->present($stocktake->fresh(['lines.item', 'location', 'creator']), $user);
        }

        return $this->finalize($stocktake, $user, postAdjustments: false);
    }

    public function approveVariances(Stocktake $stocktake, User $user): Stocktake
    {
        if ((int) $stocktake->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }
        if ($stocktake->status !== Stocktake::STATUS_PENDING_APPROVAL) {
            throw ValidationException::withMessages([
                'status' => 'Only stocktakes pending variance approval can be approved.',
            ]);
        }

        return $this->finalize($stocktake, $user, postAdjustments: true);
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

    private function finalize(Stocktake $stocktake, User $user, bool $postAdjustments): Stocktake
    {
        return DB::transaction(function () use ($stocktake, $user, $postAdjustments) {
            $stocktake->load('lines.item');

            if ($postAdjustments) {
                foreach ($stocktake->lines as $line) {
                    $variance = (int) $line->counted_qty - (int) $line->system_qty;
                    $line->variance = $variance;
                    $line->save();
                    if ($variance === 0) {
                        continue;
                    }
                    $this->stockService->recordTransaction($line->item, [
                        'type'              => StockTransaction::TYPE_ADJUSTMENT,
                        'quantity'          => $variance,
                        'reference'         => $stocktake->reference_number,
                        'reason'            => 'Stocktake variance (approved)',
                        'reason_code'       => StockTransaction::REASON_STOCKTAKE,
                        'stock_location_id' => $stocktake->stock_location_id,
                        'notes'             => $line->notes,
                        'transaction_date'  => $stocktake->count_date?->toDateString() ?? now()->toDateString(),
                        'skip_available_check' => true,
                    ], $user);
                }
            }

            $stocktake->update([
                'status'               => Stocktake::STATUS_COMPLETED,
                'completed_by'         => $user->id,
                'completed_at'         => now(),
                'variance_approved_by' => $postAdjustments ? $user->id : null,
                'variance_approved_at' => $postAdjustments ? now() : null,
            ]);

            AuditLog::record('stock.stocktake_completed', [
                'auditable_type' => Stocktake::class,
                'auditable_id'   => $stocktake->id,
                'new_values'     => [
                    'reference_number' => $stocktake->reference_number,
                    'variances_posted' => $postAdjustments,
                ],
                'tags'           => 'stock',
            ]);

            return $this->present($stocktake->fresh(['lines.item', 'location', 'creator', 'completer', 'varianceApprover']), $user);
        });
    }

    /**
     * Blind counts hide system_qty / variance from counters until approval/complete.
     */
    public function present(Stocktake $stocktake, User $user): Stocktake
    {
        $canSeeSystem = $user->isSystemAdmin()
            || $user->hasPermissionTo('stock.manage')
            || $user->hasPermissionTo('stock.admin')
            || $user->hasPermissionTo('stock.approve');

        $revealed = in_array($stocktake->status, [
            Stocktake::STATUS_PENDING_APPROVAL,
            Stocktake::STATUS_COMPLETED,
            Stocktake::STATUS_CANCELLED,
        ], true);

        if ($stocktake->is_blind && ! $canSeeSystem && ! $revealed) {
            $stocktake->setRelation(
                'lines',
                $stocktake->lines->map(function (StocktakeLine $line) {
                    $line->setAttribute('system_qty', null);
                    $line->setAttribute('variance', null);
                    return $line;
                })
            );
        }

        return $stocktake;
    }
}
