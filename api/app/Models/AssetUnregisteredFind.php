<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetUnregisteredFind extends Model
{
    protected $fillable = [
        'tenant_id', 'campaign_id', 'status', 'description', 'make', 'model',
        'serial_number', 'found_location', 'location_id', 'found_by', 'found_at',
        'notes', 'photos', 'promoted_asset_id', 'reviewed_by', 'reviewed_at',
    ];

    protected function casts(): array
    {
        return [
            'photos' => 'array',
            'found_at' => 'datetime',
            'reviewed_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AssetVerificationCampaign::class, 'campaign_id');
    }

    public function finder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'found_by');
    }

    public function promotedAsset(): BelongsTo
    {
        return $this->belongsTo(Asset::class, 'promoted_asset_id');
    }
}
