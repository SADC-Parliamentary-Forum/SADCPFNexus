<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetKitItem extends Model
{
    protected $fillable = [
        'tenant_id', 'kit_id', 'asset_id',
    ];

    public function kit(): BelongsTo
    {
        return $this->belongsTo(AssetKit::class, 'kit_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
