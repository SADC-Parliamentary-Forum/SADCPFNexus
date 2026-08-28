<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AttendanceClockEvent extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'direction', 'method', 'device_attested', 'device_id', 'clocked_at',
    ];

    protected function casts(): array
    {
        return [
            'device_attested' => 'boolean',
            'clocked_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
