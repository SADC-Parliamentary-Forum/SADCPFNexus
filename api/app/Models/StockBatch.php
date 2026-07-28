<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockBatch extends Model
{
    public const STATUS_ACTIVE = 'active';
    public const STATUS_QUARANTINED = 'quarantined';
    public const STATUS_EXHAUSTED = 'exhausted';

    protected $fillable = [
        'tenant_id',
        'stock_item_id',
        'batch_number',
        'expiry_date',
        'quantity',
        'status',
        'stock_location_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'expiry_date' => 'date',
            'quantity'    => 'integer',
        ];
    }

    public function isExpired(): bool
    {
        return $this->expiry_date !== null && $this->expiry_date->isPast();
    }

    public function isIssuable(): bool
    {
        return $this->status === self::STATUS_ACTIVE && ! $this->isExpired() && $this->quantity > 0;
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'stock_location_id');
    }

    public function scopeForTenant(Builder $query, $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }
}
