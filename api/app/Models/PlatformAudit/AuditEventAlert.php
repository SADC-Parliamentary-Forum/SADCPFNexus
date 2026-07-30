<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;

class AuditEventAlert extends Model
{
    protected $table = 'audit_event_alerts';

    protected $fillable = [
        'tenant_id', 'reference', 'severity', 'first_event_id', 'actor_id',
        'status', 'conclusion', 'notes', 'detected_at', 'closed_at',
    ];

    protected $casts = [
        'detected_at' => 'datetime',
        'closed_at' => 'datetime',
    ];
}
