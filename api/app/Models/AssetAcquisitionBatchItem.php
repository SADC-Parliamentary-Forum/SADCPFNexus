<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAcquisitionBatchItem extends Model
{
    protected $fillable = [
        'tenant_id', 'batch_id', 'asset_id', 'name', 'serial_number',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(AssetAcquisitionBatch::class, 'batch_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
