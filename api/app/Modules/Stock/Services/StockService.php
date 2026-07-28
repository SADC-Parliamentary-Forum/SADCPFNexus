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
 * Sole balance authority for consumable stock.
 * Available = on_hand − reserved − quarantined.
 */
class StockService
{
    public function __construct(
        private readonly NotificationService $notifications,
    ) {}

    /**
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
     *     stock_request_id?: int|null,
     *     stock_issue_id?: int|null,
     *     stock_transfer_id?: int|null,
     *     stock_batch_id?: int|null,
     *     reverses_transaction_id?: int|null,
     *     notes?: string|null,
     *     transaction_date: string,
     *     allow_from_reserved?: bool,
     *     skip_available_check?: bool
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

        $delta = match ($type) {
            StockTransaction::TYPE_IN  => abs($quantity),
            StockTransaction::TYPE_OUT => -abs($quantity),
            StockTransaction::TYPE_ADJUSTMENT => $quantity,
        };

        if ($delta === 0) {
            throw ValidationException::withMessages([
                'quantity' => 'Quantity must result in a non-zero change to the balance.',
            ]);
        }

        return DB::transaction(function () use ($item, $data, $user, $type, $delta, $reasonCode) {
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->lockForUpdate()->firstOrFail();

            $wasLow = $locked->reorder_level > 0 && $locked->available_quantity <= $locked->reorder_level;
            $newBalance = $locked->current_balance + $delta;

            if ($newBalance < 0) {
                throw ValidationException::withMessages([
                    'quantity' => "Insufficient stock: only {$locked->current_balance} unit(s) of \"{$locked->name}\" on hand.",
                ]);
            }

            // Ordinary outs cannot consume reserved/quarantined stock unless explicitly allowed.
            if ($delta < 0 && empty($data['skip_available_check'])) {
                $consume = abs($delta);
                $available = $locked->available_quantity;
                if (! empty($data['allow_from_reserved'])) {
                    // Issuing against a reservation: available + this reservation's hold.
                    $available = max(0, $locked->current_balance - $locked->quantity_quarantined);
                }
                if ($consume > $available) {
                    throw ValidationException::withMessages([
                        'quantity' => "Insufficient available stock: only {$available} unit(s) of \"{$locked->name}\" available (on hand {$locked->current_balance}, reserved {$locked->quantity_reserved}, quarantined {$locked->quantity_quarantined}).",
                    ]);
                }
            }

            $locked->current_balance = $newBalance;
            $locked->save();

            $transaction = StockTransaction::create([
                'tenant_id'                => $locked->tenant_id,
                'stock_item_id'            => $locked->id,
                'type'                     => $type,
                'quantity'                 => $delta,
                'balance_after'            => $newBalance,
                'issued_to_user_id'        => $data['issued_to_user_id'] ?? null,
                'issued_to_department_id'  => $data['issued_to_department_id'] ?? null,
                'issued_to_other'          => $data['issued_to_other'] ?? null,
                'unit_cost'                => $data['unit_cost'] ?? $locked->unit_cost,
                'reference'                => $data['reference'] ?? null,
                'reason'                   => $data['reason'] ?? null,
                'reason_code'              => $reasonCode ?: null,
                'stock_location_id'        => $data['stock_location_id'] ?? $locked->stock_location_id,
                'goods_receipt_note_id'    => $data['goods_receipt_note_id'] ?? null,
                'stock_request_id'         => $data['stock_request_id'] ?? null,
                'stock_issue_id'           => $data['stock_issue_id'] ?? null,
                'stock_transfer_id'        => $data['stock_transfer_id'] ?? null,
                'stock_batch_id'           => $data['stock_batch_id'] ?? null,
                'reverses_transaction_id'  => $data['reverses_transaction_id'] ?? null,
                'notes'                    => $data['notes'] ?? null,
                'transaction_date'         => $data['transaction_date'],
                'recorded_by'              => $user->id,
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

            $fresh = $locked->fresh();
            $isLow = $fresh->reorder_level > 0 && $fresh->available_quantity <= $fresh->reorder_level;
            if ($isLow && ! $wasLow) {
                $this->notifyLowStock($fresh, $user);
            }

            return $transaction;
        });
    }

    /**
     * Atomically increase reserved qty if available.
     */
    public function reserve(StockItem $item, int $qty, User $user): StockItem
    {
        if ($qty <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Reserve quantity must be positive.']);
        }

        return DB::transaction(function () use ($item, $qty, $user) {
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->where('tenant_id', $user->tenant_id)->lockForUpdate()->firstOrFail();
            if ($qty > $locked->available_quantity) {
                throw ValidationException::withMessages([
                    'quantity' => "Cannot reserve {$qty}: only {$locked->available_quantity} available for \"{$locked->name}\".",
                ]);
            }
            $locked->quantity_reserved = (int) $locked->quantity_reserved + $qty;
            $locked->save();

            return $locked->fresh();
        });
    }

    /**
     * Release reserved quantity (cancel / partial fulfil).
     */
    public function releaseReserved(StockItem $item, int $qty, User $user): StockItem
    {
        if ($qty <= 0) {
            return $item;
        }

        return DB::transaction(function () use ($item, $qty, $user) {
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->where('tenant_id', $user->tenant_id)->lockForUpdate()->firstOrFail();
            $locked->quantity_reserved = max(0, (int) $locked->quantity_reserved - $qty);
            $locked->save();

            return $locked->fresh();
        });
    }

    /**
     * Move qty into quarantine (not issuable). Does not change on-hand.
     */
    public function quarantine(StockItem $item, int $qty, User $user, ?string $notes = null): StockItem
    {
        if ($qty <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Quarantine quantity must be positive.']);
        }

        return DB::transaction(function () use ($item, $qty, $user, $notes) {
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->where('tenant_id', $user->tenant_id)->lockForUpdate()->firstOrFail();
            if ($qty > $locked->available_quantity) {
                throw ValidationException::withMessages([
                    'quantity' => "Cannot quarantine {$qty}: only {$locked->available_quantity} available.",
                ]);
            }
            $locked->quantity_quarantined = (int) $locked->quantity_quarantined + $qty;
            $locked->save();

            AuditLog::record('stock.quarantined', [
                'auditable_type' => StockItem::class,
                'auditable_id'   => $locked->id,
                'new_values'     => ['quantity' => $qty, 'notes' => $notes],
                'tags'           => 'stock',
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Release from quarantine back to available.
     */
    public function releaseQuarantine(StockItem $item, int $qty, User $user): StockItem
    {
        if ($qty <= 0) {
            throw ValidationException::withMessages(['quantity' => 'Quantity must be positive.']);
        }

        return DB::transaction(function () use ($item, $qty, $user) {
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->where('tenant_id', $user->tenant_id)->lockForUpdate()->firstOrFail();
            if ($qty > (int) $locked->quantity_quarantined) {
                throw ValidationException::withMessages([
                    'quantity' => "Only {$locked->quantity_quarantined} unit(s) are quarantined.",
                ]);
            }
            $locked->quantity_quarantined = (int) $locked->quantity_quarantined - $qty;
            $locked->save();

            AuditLog::record('stock.quarantine_released', [
                'auditable_type' => StockItem::class,
                'auditable_id'   => $locked->id,
                'new_values'     => ['quantity' => $qty],
                'tags'           => 'stock',
            ]);

            return $locked->fresh();
        });
    }

    /**
     * Reduce quarantine after write-off from quarantine (balance already reduced by ledger out).
     */
    public function consumeQuarantine(StockItem $item, int $qty, User $user): void
    {
        DB::transaction(function () use ($item, $qty, $user) {
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->where('tenant_id', $user->tenant_id)->lockForUpdate()->firstOrFail();
            $locked->quantity_quarantined = max(0, (int) $locked->quantity_quarantined - $qty);
            $locked->save();
        });
    }

    /**
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

        // Damaged portion of delivery stays out of usable stock via quarantine.
        $damaged = (int) ($line['quantity_damaged'] ?? 0);
        if ($damaged > 0) {
            $this->quarantine($item->fresh(), min($damaged, $qty), $user, 'Damaged on receipt');
        }

        return $item->fresh();
    }

    public function createItem(array $data, User $user): StockItem
    {
        $item = StockItem::create(array_merge($data, [
            'tenant_id'            => $user->tenant_id,
            'quantity_reserved'    => $data['quantity_reserved'] ?? 0,
            'quantity_quarantined' => $data['quantity_quarantined'] ?? 0,
        ]));

        AuditLog::record('stock.item_created', [
            'auditable_type' => StockItem::class,
            'auditable_id'   => $item->id,
            'new_values'     => ['item_code' => $item->item_code, 'name' => $item->name],
            'tags'           => 'stock',
        ]);

        return $item;
    }

    public function updateItem(StockItem $item, array $data, User $user): StockItem
    {
        if ((int) $item->tenant_id !== (int) $user->tenant_id) {
            abort(404);
        }

        unset(
            $data['current_balance'],
            $data['quantity_reserved'],
            $data['quantity_quarantined'],
            $data['tenant_id']
        );
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
                StockTransaction::REASON_WRITE_OFF,
            ])
            ->where('transaction_date', '>=', now()->subDays(90)->toDateString())
            ->count();

        $openStocktakes = \App\Models\Stocktake::where('tenant_id', $tenantId)
            ->whereIn('status', [
                \App\Models\Stocktake::STATUS_DRAFT,
                \App\Models\Stocktake::STATUS_IN_PROGRESS,
                \App\Models\Stocktake::STATUS_PENDING_APPROVAL,
            ])
            ->count();

        $openRequests = \App\Models\StockRequest::where('tenant_id', $tenantId)
            ->whereIn('status', [
                \App\Models\StockRequest::STATUS_SUBMITTED,
                \App\Models\StockRequest::STATUS_APPROVED,
                \App\Models\StockRequest::STATUS_PARTIALLY_ISSUED,
            ])
            ->count();

        return [
            'active_items'        => $itemCount,
            'low_stock_count'     => $lowStockCount,
            'total_stock_value'   => round($totalValue, 2),
            'issues_last_30_days' => $recentIssues,
            'loss_movements_90d'  => $lossMovements,
            'open_stocktakes'     => $openStocktakes,
            'open_requests'       => $openRequests,
            'low_stock_items'     => StockItem::where('tenant_id', $tenantId)
                ->where('status', 'active')
                ->lowStock()
                ->with(['category:id,name,code', 'location:id,code,name'])
                ->orderBy('name')
                ->limit(10)
                ->get(),
        ];
    }

    /**
     * PIF / Procurement stock availability check.
     *
     * @param  array{q?: string, item_ids?: int[], names?: string[]}  $criteria
     * @return array<int, array<string, mixed>>
     */
    public function checkAvailability(int $tenantId, array $criteria): array
    {
        $query = StockItem::where('tenant_id', $tenantId)->where('status', 'active');

        if (! empty($criteria['item_ids'])) {
            $query->whereIn('id', $criteria['item_ids']);
        } elseif (! empty($criteria['q'])) {
            $q = '%' . mb_strtolower($criteria['q']) . '%';
            $query->where(function ($builder) use ($q) {
                $builder->whereRaw('LOWER(name) LIKE ?', [$q])
                    ->orWhereRaw('LOWER(item_code) LIKE ?', [$q]);
            });
        } elseif (! empty($criteria['names'])) {
            $names = $criteria['names'];
            $query->where(function ($builder) use ($names) {
                foreach ($names as $name) {
                    $builder->orWhereRaw('LOWER(name) LIKE ?', ['%' . mb_strtolower($name) . '%']);
                }
            });
        } else {
            return [];
        }

        return $query->with(['location:id,code,name', 'category:id,name,code'])
            ->orderBy('name')
            ->limit(50)
            ->get()
            ->map(fn (StockItem $item) => [
                'id'                    => $item->id,
                'item_code'             => $item->item_code,
                'name'                  => $item->name,
                'unit'                  => $item->unit,
                'on_hand'               => (int) $item->current_balance,
                'reserved'              => (int) $item->quantity_reserved,
                'quarantined'           => (int) $item->quantity_quarantined,
                'available'             => $item->available_quantity,
                'reorder_level'         => (int) $item->reorder_level,
                'is_low_stock'          => $item->is_low_stock,
                'location'              => $item->location,
                'recommendation'        => $item->available_quantity > 0
                    ? 'Use existing stock before buying'
                    : 'No available stock — procurement may be required',
            ])
            ->values()
            ->all();
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
                'balance'       => (string) $item->available_quantity,
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
                'available'     => $item->available_quantity,
                'reorder_level' => $item->reorder_level,
            ],
            'tags'           => 'stock',
        ]);
    }
}
