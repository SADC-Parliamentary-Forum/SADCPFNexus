<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditModuleEvent extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'tenant_id', 'event', 'auditable_type', 'auditable_id', 'actor_id',
        'payload', 'entry_hash', 'previous_hash', 'created_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        // Immutable to ordinary users — block Eloquent updates/deletes.
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }
}
