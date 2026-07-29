<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FleetServiceSchedule extends Model
{
    protected $fillable = [
        'tenant_id',
        'asset_id',
        'service_type',
        'interval_km',
        'interval_days',
        'last_service_at',
        'last_service_odometer_km',
        'next_due_at',
        'next_due_odometer_km',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'interval_km' => 'integer',
            'interval_days' => 'integer',
            'last_service_at' => 'date',
            'last_service_odometer_km' => 'integer',
            'next_due_at' => 'date',
            'next_due_odometer_km' => 'integer',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }
}
