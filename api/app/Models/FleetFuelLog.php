<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FleetFuelLog extends Model
{
    protected $fillable = [
        'tenant_id',
        'asset_id',
        'logged_at',
        'litres',
        'cost_amount',
        'currency',
        'odometer_km',
        'station',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'logged_at' => 'datetime',
            'litres' => 'float',
            'cost_amount' => 'float',
            'odometer_km' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
