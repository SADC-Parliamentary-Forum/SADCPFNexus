<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetImportLineage extends Model
{
    protected $table = 'asset_import_lineage';

    protected $fillable = [
        'import_batch_id', 'staging_id', 'asset_tag', 'raw_id', 'source_kind',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(AssetImportBatch::class, 'import_batch_id');
    }

    public function staging(): BelongsTo
    {
        return $this->belongsTo(AssetImportStaging::class, 'staging_id');
    }

    public function raw(): BelongsTo
    {
        return $this->belongsTo(AssetImportRaw::class, 'raw_id');
    }
}
