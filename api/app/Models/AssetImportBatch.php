<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetImportBatch extends Model
{
    protected $fillable = [
        'tenant_id', 'batch_number', 'mode', 'filenames', 'file_hashes', 'fingerprint',
        'uploaded_by', 'uploaded_at', 'source_row_count', 'parsed_row_count',
        'rejected_row_count', 'duplicate_count', 'warning_count', 'imported_count',
        'updated_count', 'unchanged_count', 'excluded_count', 'unresolved_count',
        'unique_tag_count', 'status', 'committed_at', 'completed_at', 'summary',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'filenames' => 'array',
            'file_hashes' => 'array',
            'summary' => 'array',
            'uploaded_at' => 'datetime',
            'committed_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function rawRows(): HasMany
    {
        return $this->hasMany(AssetImportRaw::class, 'import_batch_id');
    }

    public function stagingRows(): HasMany
    {
        return $this->hasMany(AssetImportStaging::class, 'import_batch_id');
    }

    public function discrepancies(): HasMany
    {
        return $this->hasMany(AssetImportDiscrepancy::class, 'import_batch_id');
    }

    public function lineage(): HasMany
    {
        return $this->hasMany(AssetImportLineage::class, 'import_batch_id');
    }
}
