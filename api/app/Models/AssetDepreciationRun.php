<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetDepreciationRun extends Model
{
    protected $fillable = [
        'tenant_id', 'policy_id', 'run_date', 'period_start', 'period_end',
        'status', 'run_by', 'asset_count', 'total_depreciation',
    ];

    protected function casts(): array
    {
        return [
            'run_date' => 'date',
            'period_start' => 'date',
            'period_end' => 'date',
            'total_depreciation' => 'decimal:2',
        ];
    }

    public function lines(): HasMany
    {
        return $this->hasMany(AssetDepreciationRunLine::class, 'run_id');
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(AssetDepreciationRatePolicy::class, 'policy_id');
    }

    public function runner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'run_by');
    }
}
