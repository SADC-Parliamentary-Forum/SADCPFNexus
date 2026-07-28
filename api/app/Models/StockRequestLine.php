<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class StockRequestLine extends Model
{
    protected $fillable = [
        'stock_request_id',
        'stock_item_id',
        'quantity_requested',
        'quantity_approved',
        'quantity_issued',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity_requested' => 'integer',
            'quantity_approved'  => 'integer',
            'quantity_issued'    => 'integer',
        ];
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(StockRequest::class, 'stock_request_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function reservation(): HasOne
    {
        return $this->hasOne(StockReservation::class);
    }
}
