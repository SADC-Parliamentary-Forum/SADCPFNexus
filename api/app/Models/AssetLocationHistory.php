<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetLocationHistory extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'location_id', 'location_label',
        'moved_at', 'moved_by', 'notes',
    ];

    protected function casts(): array
    {
        return ['moved_at' => 'datetime'];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class, 'location_id');
    }
}
