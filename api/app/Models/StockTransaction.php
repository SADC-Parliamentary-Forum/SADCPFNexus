<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A stock movement (PRD §17.3): stock-in, stock-out or adjustment.
 * `quantity` is the signed delta applied to the item balance; `balance_after`
 * is the resulting balance snapshot, forming an immutable running ledger.
 */
class StockTransaction extends Model
{
    public const TYPE_IN = 'in';
    public const TYPE_OUT = 'out';
    public const TYPE_ADJUSTMENT = 'adjustment';

    public const TYPES = [self::TYPE_IN, self::TYPE_OUT, self::TYPE_ADJUSTMENT];

    protected $fillable = [
        'tenant_id',
        'stock_item_id',
        'type',
        'quantity',
        'balance_after',
        'issued_to_user_id',
        'issued_to_department_id',
        'issued_to_other',
        'unit_cost',
        'reference',
        'reason',
        'notes',
        'transaction_date',
        'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'quantity'         => 'integer',
            'balance_after'    => 'integer',
            'unit_cost'        => 'decimal:2',
            'transaction_date' => 'date',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function issuedToUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'issued_to_user_id');
    }

    public function issuedToDepartment(): BelongsTo
    {
        return $this->belongsTo(Department::class, 'issued_to_department_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
