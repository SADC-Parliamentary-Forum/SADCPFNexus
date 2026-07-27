<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetMaintenanceRecord extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'maintenance_type', 'status', 'title',
        'description', 'scheduled_on', 'completed_on', 'cost', 'vendor',
        'under_warranty', 'recorded_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_on' => 'date',
            'completed_on' => 'date',
            'cost' => 'decimal:2',
            'under_warranty' => 'boolean',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
