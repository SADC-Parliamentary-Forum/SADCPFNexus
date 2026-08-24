<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockEventPackLine extends Model
{
    protected $fillable = [
        'stock_event_pack_id', 'stock_item_id', 'quantity', 'notes',
    ];

    public function pack(): BelongsTo
    {
        return $this->belongsTo(StockEventPack::class, 'stock_event_pack_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }
}
