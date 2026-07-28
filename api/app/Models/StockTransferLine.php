<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockTransferLine extends Model
{
    protected $fillable = [
        'stock_transfer_id',
        'stock_item_id',
        'stock_batch_id',
        'quantity',
        'dispatch_transaction_id',
        'receive_transaction_id',
        'notes',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    public function transfer(): BelongsTo
    {
        return $this->belongsTo(StockTransfer::class, 'stock_transfer_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class, 'stock_batch_id');
    }

    public function dispatchTransaction(): BelongsTo
    {
        return $this->belongsTo(StockTransaction::class, 'dispatch_transaction_id');
    }

    public function receiveTransaction(): BelongsTo
    {
        return $this->belongsTo(StockTransaction::class, 'receive_transaction_id');
    }
}
