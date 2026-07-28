<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Immutable stock ledger line. quantity is signed delta; balance_after is snapshot.
 */
class StockTransaction extends Model
{
    public const TYPE_IN = 'in';
    public const TYPE_OUT = 'out';
    public const TYPE_ADJUSTMENT = 'adjustment';

    public const TYPES = [self::TYPE_IN, self::TYPE_OUT, self::TYPE_ADJUSTMENT];

    public const REASON_RECEIPT = 'receipt';
    public const REASON_ISSUE = 'issue';
    public const REASON_RETURN = 'return';
    public const REASON_TRANSFER = 'transfer';
    public const REASON_SHORTAGE = 'shortage';
    public const REASON_DAMAGED = 'damaged';
    public const REASON_EXPIRED = 'expired';
    public const REASON_WRITE_OFF = 'write_off';
    public const REASON_STOCKTAKE = 'stocktake';
    public const REASON_OTHER = 'other';

    public const REASON_CODES = [
        self::REASON_RECEIPT,
        self::REASON_ISSUE,
        self::REASON_RETURN,
        self::REASON_TRANSFER,
        self::REASON_SHORTAGE,
        self::REASON_DAMAGED,
        self::REASON_EXPIRED,
        self::REASON_WRITE_OFF,
        self::REASON_STOCKTAKE,
        self::REASON_OTHER,
    ];

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
        'reason_code',
        'stock_location_id',
        'goods_receipt_note_id',
        'stock_request_id',
        'stock_issue_id',
        'stock_transfer_id',
        'stock_batch_id',
        'reverses_transaction_id',
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

    public function location(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'stock_location_id');
    }

    public function goodsReceiptNote(): BelongsTo
    {
        return $this->belongsTo(GoodsReceiptNote::class);
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(StockRequest::class, 'stock_request_id');
    }

    public function issue(): BelongsTo
    {
        return $this->belongsTo(StockIssue::class, 'stock_issue_id');
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class, 'stock_batch_id');
    }

    public function reverses(): BelongsTo
    {
        return $this->belongsTo(self::class, 'reverses_transaction_id');
    }

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }
}
