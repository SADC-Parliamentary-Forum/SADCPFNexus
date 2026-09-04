<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetImportDiscrepancy extends Model
{
    protected $fillable = [
        'import_batch_id', 'staging_id', 'asset_tag', 'field',
        'source_a_value', 'source_b_value', 'chosen_value', 'rule', 'requires_review',
    ];

    protected function casts(): array
    {
        return ['requires_review' => 'boolean'];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(AssetImportBatch::class, 'import_batch_id');
    }
}
