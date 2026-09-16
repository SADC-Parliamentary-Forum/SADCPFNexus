<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetAttestationResponse extends Model
{
    protected $fillable = [
        'tenant_id', 'campaign_id', 'user_id', 'asset_id', 'confirmed', 'attested_at',
    ];

    protected function casts(): array
    {
        return [
            'confirmed' => 'boolean',
            'attested_at' => 'datetime',
        ];
    }

    public function campaign(): BelongsTo
    {
        return $this->belongsTo(AssetAttestationCampaign::class, 'campaign_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
