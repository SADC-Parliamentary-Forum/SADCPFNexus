<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetVerificationResult extends Model
{
    protected $fillable = [
        'campaign_id', 'asset_id', 'result', 'condition',
        'verified_by', 'verified_at', 'notes',
    ];

    protected function casts(): array
    {
        return ['verified_at' => 'datetime'];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AssetVerificationCampaign::class, 'campaign_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
