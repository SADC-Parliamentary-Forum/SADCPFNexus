<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditExternalAccessLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'tenant_id', 'external_engagement_id', 'actor_id', 'action', 'meta', 'ip_address', 'created_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
