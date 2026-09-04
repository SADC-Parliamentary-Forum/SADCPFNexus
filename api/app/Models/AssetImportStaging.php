<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetImportStaging extends Model
{
    protected $table = 'asset_import_staging';

    protected $fillable = [
        'import_batch_id', 'tenant_id', 'asset_tag', 'asset_name', 'description',
        'legacy_description', 'legacy_category', 'category_code', 'make', 'model',
        'serial_number', 'acquisition_date', 'original_cost', 'opening_depreciation',
        'source_depreciation', 'accumulated_depreciation', 'current_book_value',
        'currency', 'funding_source', 'legacy_location', 'location_id',
        'custodian_candidate', 'custodian_type', 'custodian_user_id',
        'custodian_department_id', 'custodian_confidence', 'status', 'proposed_action',
        'review_status', 'blocking', 'blocking_errors', 'warnings', 'data_quality_flags',
        'data_quality_status', 'matched_asset_id', 'field_diff', 'source_refs',
        'admin_notes', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'acquisition_date' => 'date',
            'original_cost' => 'decimal:2',
            'opening_depreciation' => 'decimal:2',
            'source_depreciation' => 'decimal:2',
            'accumulated_depreciation' => 'decimal:2',
            'current_book_value' => 'decimal:2',
            'custodian_confidence' => 'decimal:2',
            'blocking' => 'boolean',
            'blocking_errors' => 'array',
            'warnings' => 'array',
            'data_quality_flags' => 'array',
            'field_diff' => 'array',
            'source_refs' => 'array',
            'reviewed_at' => 'datetime',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(AssetImportBatch::class, 'import_batch_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class, 'location_id');
    }

    public function matchedAsset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'matched_asset_id');
    }

    public function lineage(): HasMany
    {
        return $this->hasMany(AssetImportLineage::class, 'staging_id');
    }
}
