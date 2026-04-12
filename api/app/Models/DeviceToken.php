<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeviceToken extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'token',
        'platform',
        'device_name',
        'last_used_at',
    ];

    protected $casts = [
        'last_used_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Upsert a device token for a user (inserts or updates if token already exists).
     */
    public static function register(
        int $userId,
        int $tenantId,
        string $token,
        string $platform = 'android',
        ?string $deviceName = null
    ): self {
        return static::updateOrCreate(
            ['token' => $token],
            [
                'user_id'       => $userId,
                'tenant_id'     => $tenantId,
                'platform'      => $platform,
                'device_name'   => $deviceName,
                'last_used_at'  => now(),
            ]
        );
    }
}
