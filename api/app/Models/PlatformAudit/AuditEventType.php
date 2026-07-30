<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;

class AuditEventType extends Model
{
    protected $table = 'audit_event_types';

    protected $fillable = [
        'event_key', 'name', 'description', 'category', 'severity',
        'required_fields', 'optional_fields', 'sensitive_fields',
        'actor_required', 'subject_required', 'retention_class',
        'alert_policy', 'user_visible_label', 'effective_version', 'status',
    ];

    protected $casts = [
        'required_fields' => 'array',
        'optional_fields' => 'array',
        'sensitive_fields' => 'array',
        'actor_required' => 'boolean',
        'subject_required' => 'boolean',
    ];
}
