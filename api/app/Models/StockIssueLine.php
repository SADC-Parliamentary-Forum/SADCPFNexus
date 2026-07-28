<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockIssueLine extends Model
{
    protected $fillable = [
        'stock_issue_id',
        'stock_item_id',
        'stock_request_line_id',
        'stock_batch_id',
        'stock_transaction_id',
        'quantity',
        'notes',
    ];

    protected function casts(): array
    {
        return ['quantity' => 'integer'];
    }

    public function issue(): BelongsTo
    {
        return $this->belongsTo(StockIssue::class, 'stock_issue_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function requestLine(): BelongsTo
    {
        return $this->belongsTo(StockRequestLine::class, 'stock_request_line_id');
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(StockBatch::class, 'stock_batch_id');
    }

    public function transaction(): BelongsTo
    {
        return $this->belongsTo(StockTransaction::class, 'stock_transaction_id');
    }
}
