<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetLocation extends Model
{
    protected $fillable = [
        'tenant_id', 'code', 'name', 'building', 'floor', 'room',
        'location_type', 'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'location_id');
    }
}
