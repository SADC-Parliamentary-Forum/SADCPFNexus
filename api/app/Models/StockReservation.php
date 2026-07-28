<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReservation extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_FULFILLED = 'fulfilled';
    public const STATUS_RELEASED = 'released';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id',
        'stock_request_id',
        'stock_request_line_id',
        'stock_item_id',
        'quantity',
        'quantity_released',
        'status',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'quantity'          => 'integer',
            'quantity_released' => 'integer',
            'expires_at'        => 'datetime',
        ];
    }

    public function remaining(): int
    {
        return max(0, (int) $this->quantity - (int) $this->quantity_released);
    }

    public function request(): BelongsTo
    {
        return $this->belongsTo(StockRequest::class, 'stock_request_id');
    }

    public function line(): BelongsTo
    {
        return $this->belongsTo(StockRequestLine::class, 'stock_request_line_id');
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', self::STATUS_ACTIVE);
    }
}
