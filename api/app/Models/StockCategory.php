<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Configurable consumables/stock category (PRD §27). Separate from AssetCategory.
 */
class StockCategory extends Model
{
    protected $fillable = ['tenant_id', 'name', 'code', 'sort_order'];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Stock items in this category.
     */
    public function items(): HasMany
    {
        return $this->hasMany(StockItem::class);
    }

    /**
     * Scope to current tenant (by tenant_id).
     */
    public function scopeForTenant($query, $tenantId): void
    {
        $query->where('tenant_id', $tenantId);
    }
}
