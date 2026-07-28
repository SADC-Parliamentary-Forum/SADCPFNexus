<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class StockUnit extends Model
{
    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'base_unit_id',
        'conversion_factor',
        'is_active',
        'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_active'         => 'boolean',
            'sort_order'        => 'integer',
            'conversion_factor' => 'decimal:4',
        ];
    }

    /**
     * Convert quantity in this unit to base-unit quantity.
     */
    public function toBaseQuantity(float|int $qty): float
    {
        if ($this->base_unit_id === null || $this->conversion_factor === null) {
            return (float) $qty;
        }

        return (float) $qty * (float) $this->conversion_factor;
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function baseUnit(): BelongsTo
    {
        return $this->belongsTo(self::class, 'base_unit_id');
    }

    public function items(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }

    public function scopeForTenant(Builder $query, $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
