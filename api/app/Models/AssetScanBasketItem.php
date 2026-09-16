<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetScanBasketItem extends Model
{
    protected $fillable = [
        'tenant_id', 'basket_id', 'asset_id', 'scan_method', 'token', 'nfc_uid',
    ];

    public function basket(): BelongsTo
    {
        return $this->belongsTo(AssetScanBasket::class, 'basket_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
