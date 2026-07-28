<?php

namespace App\Modules\Stock\Services;

use App\Models\AuditLog;
use App\Models\GoodsReceiptNote;
use App\Models\StockItem;
use App\Models\StockTransaction;
use App\Models\User;
use App\Services\NotificationService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/**
 * Business logic for the Consumables / Stock Register.
 *
 * All balance mutations go through {@see recordTransaction()} which runs inside a
 * DB transaction with a row-level lock on the stock item, guaranteeing that
 * concurrent issues can never drive the balance negative.
 */
class StockService
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
     * Record a stock movement and atomically update the item balance.
     *
     * @param  array{
     *     type: string,
     *     quantity: int,
     *     issued_to_user_id?: int|null,
     *     issued_to_department_id?: int|null,
     *     issued_to_other?: string|null,
     *     unit_cost?: float|null,
     *     reference?: string|null,
     *     reason?: string|null,
     *     reason_code?: string|null,
     *     stock_location_id?: int|null,
     *     goods_receipt_note_id?: int|null,
     *     notes?: string|null,
     *     transaction_date: string
     * }  $data
     */
    public function recordTransaction(StockItem $item, array $data, User $user): StockTransaction
    {
        if ((int) $item->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        $type = $data['type'];
        $quantity = (int) $data['quantity'];

        if (! in_array($type, StockTransaction::TYPES, true)) {
            throw ValidationException::withMessages(['type' => 'Invalid stock transaction type.']);
        }

        $reasonCode = $data['reason_code'] ?? null;
        if ($reasonCode !== null && $reasonCode !== '' && ! in_array($reasonCode, StockTransaction::REASON_CODES, true)) {
            throw ValidationException::withMessages(['reason_code' => 'Invalid stock reason code.']);
        }

        // Normalise the signed delta applied to the balance.
        $delta = match ($type) {
            StockTransaction::TYPE_IN  => abs($quantity),
            StockTransaction::TYPE_OUT => -abs($quantity),
            // Adjustment carries a signed delta (correction) exactly as supplied.
            StockTransaction::TYPE_ADJUSTMENT => $quantity,
        };

        if ($delta === 0) {
            throw ValidationException::withMessages([
                'quantity' => 'Quantity must result in a non-zero change to the balance.',
            ]);
        }

        return DB::transaction(function () use ($item, $data, $user, $type, $delta, $reasonCode) {
            // Row-level lock prevents concurrent movements from racing the balance.
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->lockForUpdate()->firstOrFail();

            $wasLow = $locked->reorder_level > 0 && $locked->current_balance <= $locked->reorder_level;
            $newBalance = $locked->current_balance + $delta;

            if ($newBalance < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Insufficient stock: only {$locked->current_balance} unit(s) of \"{$locked->name}\" on hand.",
                ]);
            }

            $locked->current_balance = $newBalance;
            $locked->save();

            $transaction = StockTransaction::create([
                'tenant_id'               => $locked->tenant_id,
                'stock_item_id'           => $locked->id,
                'type'                    => $type,
                'quantity'                => $delta,
                'balance_after'           => $newBalance,
                'issued_to_user_id'       => $data['issued_to_user_id'] ?? null,
                'issued_to_department_id' => $data['issued_to_department_id'] ?? null,
                'issued_to_other'         => $data['issued_to_other'] ?? null,
                'unit_cost'               => $data['unit_cost'] ?? $locked->unit_cost,
                'reference'               => $data['reference'] ?? null,
                'reason'                  => $data['reason'] ?? null,
                'reason_code'             => $reasonCode ?: null,
                'stock_location_id'       => $data['stock_location_id'] ?? $locked->stock_location_id,
                'goods_receipt_note_id'   => $data['goods_receipt_note_id'] ?? null,
                'notes'                   => $data['notes'] ?? null,
                'transaction_date'        => $data['transaction_date'],
                'recorded_by'             => $user->id,
            ]);

            AuditLog::record('stock.' . $type, [
                'auditable_type' => StockTransaction::class,
                'auditable_id'   => $transaction->id,
                'new_values'     => [
                    'stock_item_id' => $locked->id,
                    'item'          => $locked->name,
                    'delta'         => $delta,
                    'balance_after' => $newBalance,
                    'reason_code'   => $reasonCode,
                ],
                'tags'           => 'stock',
            ]);

            $isLow = $locked->reorder_level > 0 && $newBalance <= $locked->reorder_level;
            if ($isLow && ! $wasLow) {
                $this->notifyLowStock($locked->fresh(), $user);
            }

            return $transaction;
        });
    }

    /**
     * GRN stock handoff: create a new SKU or replenish an existing one, always via ledgered stock-in.
     *
     * @param  array<string, mixed>  $line
     */
    public function receiveFromGrn(GoodsReceiptNote $grn, array $line, User $user, ?int $procurementRequestId = null): StockItem
    {
        $qty = (int) ($line['quantity'] ?? 0);
        if ($qty <= 0) {
            throw ValidationException::withMessages([
                'handoff' => 'Stock handoff requires a positive quantity.',
            ]);
        }

        $existingId = isset($line['stock_item_id']) ? (int) $line['stock_item_id'] : null;

        if ($existingId) {
            $item = StockItem::where('tenant_id', $user->tenant_id)->find($existingId);
            if (! $item) {
                throw ValidationException::withMessages([
                    'handoff' => "Stock item #{$existingId} not found for replenishment.",
                ]);
            }
        } else {
            $item = $this->createItem([
                'stock_category_id'      => $line['stock_category_id'] ?? null,
                'item_code'              => $line['item_code'] ?? ('STK-' . strtoupper(Str::random(8))),
                'name'                   => $line['name'],
                'unit'                   => $line['unit'] ?? 'each',
                'stock_unit_id'          => $line['stock_unit_id'] ?? null,
                'stock_location_id'      => $line['stock_location_id'] ?? null,
                'unit_cost'              => $line['unit_cost'] ?? null,
                'current_balance'        => 0,
                'reorder_level'          => $line['reorder_level'] ?? 0,
                'procurement_request_id' => $procurementRequestId,
                'purchase_order_id'      => $grn->purchase_order_id,
                'status'                 => 'active',
            ], $user);
        }

        $this->recordTransaction($item, [
            'type'                   => StockTransaction::TYPE_IN,
            'quantity'               => $qty,
            'unit_cost'              => $line['unit_cost'] ?? $item->unit_cost,
            'reference'              => 'GRN-' . $grn->id,
            'reason'                 => 'Goods receipt handoff',
            'reason_code'            => StockTransaction::REASON_RECEIPT,
            'goods_receipt_note_id'  => $grn->id,
            'stock_location_id'      => $line['stock_location_id'] ?? $item->stock_location_id,
            'notes'                  => $line['notes'] ?? null,
            'transaction_date'       => now()->toDateString(),
        ], $user);

        return $item->fresh();
    }

    /**
     * Create a stock item with an audit entry.
     */
    public function createItem(array $data, User $user): StockItem
    {
        $item = StockItem::create(array_merge($data, ['tenant_id' => $user->tenant_id]));

        AuditLog::record('stock.item_created', [
            'auditable_type' => StockItem::class,
            'auditable_id'   => $item->id,
            'new_values'     => ['item_code' => $item->item_code, 'name' => $item->name],
            'tags'           => 'stock',
        ]);

        return $item;
    }

    /**
     * Update a stock item with an audit entry. Balance is NOT mutable here —
     * use {@see recordTransaction()} so every balance change is ledgered.
     */
    public function updateItem(StockItem $item, array $data, User $user): StockItem
    {
        if ((int) $item->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        unset($data['current_balance'], $data['tenant_id']);
        $old = $item->only(array_keys($data));
        $item->update($data);

        AuditLog::record('stock.item_updated', [
            'auditable_type' => StockItem::class,
            'auditable_id'   => $item->id,
            'old_values'     => $old,
            'new_values'     => $data,
            'tags'           => 'stock',
        ]);

        return $item->fresh();
    }

    /**
     * Dashboard KPIs for the consumables / stock register.
     *
     * @return array<string, mixed>
     */
    public function dashboard(int $tenantId): array
    {
        $activeItems = StockItem::where('tenant_id', $tenantId)->where('status', 'active');
        $itemCount = (clone $activeItems)->count();
        $lowStockCount = (clone $activeItems)->lowStock()->count();
        $totalValue = (float) (clone $activeItems)->get()->sum(fn (StockItem $i) => (float) ($i->stock_value ?? 0));

        $recentIssues = StockTransaction::where('tenant_id', $tenantId)
            ->where('type', StockTransaction::TYPE_OUT)
            ->where('transaction_date', '>=', now()->subDays(30)->toDateString())
            ->count();

        $lossMovements = StockTransaction::where('tenant_id', $tenantId)
            ->whereIn('reason_code', [
                StockTransaction::REASON_SHORTAGE,
                StockTransaction::REASON_DAMAGED,
                StockTransaction::REASON_EXPIRED,
            ])
            ->where('transaction_date', '>=', now()->subDays(90)->toDateString())
            ->count();

        $openStocktakes = \App\Models\Stocktake::where('tenant_id', $tenantId)
            ->whereIn('status', [\App\Models\Stocktake::STATUS_DRAFT, \App\Models\Stocktake::STATUS_IN_PROGRESS])
            ->count();

        return [
            'active_items'       => $itemCount,
            'low_stock_count'    => $lowStockCount,
            'total_stock_value'  => round($totalValue, 2),
            'issues_last_30_days'=> $recentIssues,
            'loss_movements_90d' => $lossMovements,
            'open_stocktakes'    => $openStocktakes,
            'low_stock_items'    => StockItem::where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->lowStock()
                ->with(['category:id,name,code', 'location:id,code,name'])
                ->orderBy('name')
                ->limit(10)
                ->get(),
        ];
    }

    private function notifyLowStock(StockItem $item, User $actor): void
    {
        $recipients = User::query()
            ->where('tenant_id', $item->tenant_id)
            ->where('is_active', true)
            ->get()
            ->filter(fn (User $u) => $u->isSystemAdmin()
                || $u->hasPermissionTo('stock.manage')
                || $u->hasPermissionTo('stock.admin'));

        if ($recipients->isEmpty()) {
            return;
        }

        $this->notifications->dispatchToMany(
            $recipients,
            'stock.low_stock',
            [
                'item_name'     => $item->name,
                'item_code'     => $item->item_code,
                'balance'       => (string) $item->current_balance,
                'reorder_level' => (string) $item->reorder_level,
                'actor'         => $actor->name,
            ],
            [
                'module'    => 'stock',
                'record_id' => $item->id,
                'url'       => '/stock/low-stock',
                'trigger'   => 'stock.low_stock',
            ],
            false,
        );

        AuditLog::record('stock.low_stock_alert', [
            'auditable_type' => StockItem::class,
            'auditable_id'   => $item->id,
            'new_values'     => [
                'balance'       => $item->current_balance,
                'reorder_level' => $item->reorder_level,
            ],
            'tags'           => 'stock',
        ]);
    }
}
