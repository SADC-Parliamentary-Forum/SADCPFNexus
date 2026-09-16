<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetScanBasket extends Model
{
    protected $fillable = [
        'tenant_id', 'status', 'handover_id', 'created_by',
    ];

    public function items(): HasMany
    {
        return $this->hasMany(AssetScanBasketItem::class, 'basket_id');
    }

    public function handover(): BelongsTo
    {
        return $this->belongsTo(AssetHandover::class, 'handover_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
