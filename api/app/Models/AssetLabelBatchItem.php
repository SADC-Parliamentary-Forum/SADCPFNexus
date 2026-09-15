<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetLabelBatchItem extends Model
{
    protected $fillable = [
        'label_batch_id', 'asset_id', 'position',
        'recovery_contact_version', 'printed_custodian_id', 'printed_location_id',
        'printed_description', 'asset_label_id',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(AssetLabelBatch::class, 'label_batch_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
