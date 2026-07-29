<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FleetDriver extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'licence_number',
        'licence_expires_on',
        'status',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'licence_expires_on' => 'date',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bookings(): HasMany
    {
        return $this->hasMany(FleetBooking::class, 'driver_id');
    }
}
