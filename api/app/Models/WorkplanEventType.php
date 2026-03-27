<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkplanEventType extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'slug', 'icon', 'color', 'is_system', 'sort_order',
    ];

    protected function casts(): array
    {
        return [
            'is_system'  => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeForTenant(Builder $query, int $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId)->orderBy('sort_order')->orderBy('name');
    }

    /** True when this slug is used by any workplan_events in the tenant. */
    public function isInUse(): bool
    {
        return WorkplanEvent::where('tenant_id', $this->tenant_id)
            ->where('type', $this->slug)
            ->exists();
    }
}
