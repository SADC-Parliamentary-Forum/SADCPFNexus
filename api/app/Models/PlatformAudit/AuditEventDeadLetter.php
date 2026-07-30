<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;

class AuditEventDeadLetter extends Model
{
    protected $table = 'audit_event_dead_letters';

    protected $fillable = [
        'tenant_id', 'event_uuid', 'outbox_id', 'event_key', 'payload',
        'error_message', 'status', 'resolved_by', 'resolved_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'resolved_at' => 'datetime',
    ];
}
