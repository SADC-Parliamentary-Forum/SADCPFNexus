<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetKit extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'notes', 'created_by',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(AssetKitItem::class, 'kit_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
