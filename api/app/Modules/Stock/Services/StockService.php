<?php

namespace App\Modules\Stock\Services;

use App\Models\AuditLog;
use App\Models\StockItem;
use App\Models\StockTransaction;
use App\Models\User;
use Illuminate\Support\Facades\DB;
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

        return DB::transaction(function () use ($item, $data, $user, $type, $delta) {
            // Row-level lock prevents concurrent movements from racing the balance.
            /** @var StockItem $locked */
            $locked = StockItem::whereKey($item->id)->lockForUpdate()->firstOrFail();

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
                ],
                'tags'           => 'stock',
            ]);

            return $transaction;
        });
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
}
