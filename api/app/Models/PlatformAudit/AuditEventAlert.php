<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventAlert extends Model
{
    protected $table = 'audit_event_alerts';

    protected $fillable = [
        'tenant_id', 'rule_id', 'reference', 'severity', 'first_event_id', 'event_ids',
        'actor_id', 'status', 'classification', 'reviewed_by', 'reviewed_at',
        'workflow_status', 'conclusion', 'notes', 'assigned_to', 'assigned_at',
        'last_detected_at', 'incident_id', 'detected_at', 'closed_at',
    ];

    protected $casts = [
        'detected_at' => 'datetime',
        'closed_at' => 'datetime',
        'reviewed_at' => 'datetime',
        'assigned_at' => 'datetime',
        'last_detected_at' => 'datetime',
        'event_ids' => 'array',
    ];

    public function rule(): BelongsTo
    {
        return $this->belongsTo(SecurityMonitoringRule::class, 'rule_id');
    }
}
