<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StocktakeLine extends Model
{
    protected $fillable = [
        'stocktake_id',
        'stock_item_id',
        'system_qty',
        'counted_qty',
        'variance',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'system_qty'  => 'integer',
            'counted_qty' => 'integer',
            'variance'    => 'integer',
        ];
    }

    public function stocktake(): BelongsTo
    {
        return $this->belongsTo(Stocktake::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }
}
