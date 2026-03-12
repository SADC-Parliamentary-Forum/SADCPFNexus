<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetCategory extends Model
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
     * Assets that use this category (Asset.category = code, same tenant).
     */
    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'category', 'code')
            ->where('assets.tenant_id', $this->tenant_id);
    }

    /**
     * Scope to current tenant (by tenant_id).
     */
    public function scopeForTenant($query, $tenantId): void
    {
        $query->where('tenant_id', $tenantId);
    }
}
