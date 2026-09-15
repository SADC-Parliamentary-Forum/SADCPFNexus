<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetConditionAssessment extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'previous_condition', 'new_condition',
        'assessor_id', 'reason', 'assessed_at',
    ];

    protected function casts(): array
    {
        return ['assessed_at' => 'datetime'];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
