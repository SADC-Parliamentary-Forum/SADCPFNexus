<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FleetTripLog extends Model
{
    protected $fillable = [
        'tenant_id',
        'asset_id',
        'driver_user_id',
        'started_at',
        'ended_at',
        'start_odometer_km',
        'end_odometer_km',
        'distance_km',
        'purpose',
        'origin',
        'destination',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'start_odometer_km' => 'integer',
            'end_odometer_km' => 'integer',
            'distance_km' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function driver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'driver_user_id');
    }
}
