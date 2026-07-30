<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;

class AuditEventOutbox extends Model
{
    protected $table = 'audit_event_outbox';

    protected $fillable = [
        'tenant_id', 'event_uuid', 'idempotency_key', 'event_key', 'payload',
        'status', 'attempts', 'last_error', 'available_at', 'processed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'available_at' => 'datetime',
        'processed_at' => 'datetime',
    ];
}
