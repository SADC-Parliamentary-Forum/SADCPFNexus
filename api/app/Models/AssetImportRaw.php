<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetImportRaw extends Model
{
    protected $table = 'asset_import_raw';

    protected $fillable = [
        'import_batch_id', 'source_filename', 'source_sheet', 'source_row_number',
        'source_kind', 'raw_json', 'row_fingerprint',
    ];

    protected function casts(): array
    {
        return [
            'raw_json' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(AssetImportBatch::class, 'import_batch_id');
    }
}
