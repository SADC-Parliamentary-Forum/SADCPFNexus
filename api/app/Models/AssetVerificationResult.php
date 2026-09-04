<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetVerificationResult extends Model
{
    protected $fillable = [
        'campaign_id', 'asset_id', 'result', 'condition',
        'verified_by', 'verified_at', 'notes',
        'verification_method', 'gps_lat', 'gps_lng', 'device_id', 'photos',
        'mismatch_types', 'unregistered_find_id',
    ];

    protected function casts(): array
    {
        return [
            'verified_at' => 'datetime',
            'photos' => 'array',
            'mismatch_types' => 'array',
            'gps_lat' => 'decimal:7',
            'gps_lng' => 'decimal:7',
        ];
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
