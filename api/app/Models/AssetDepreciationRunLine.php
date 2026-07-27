<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetDepreciationRunLine extends Model
{
    protected $fillable = [
        'run_id', 'asset_id', 'opening_book_value', 'depreciation_amount',
        'closing_book_value', 'accumulated_depreciation',
    ];

    protected function casts(): array
    {
        return [
            'opening_book_value' => 'decimal:2',
            'depreciation_amount' => 'decimal:2',
            'closing_book_value' => 'decimal:2',
            'accumulated_depreciation' => 'decimal:2',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(AssetDepreciationRun::class, 'run_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
