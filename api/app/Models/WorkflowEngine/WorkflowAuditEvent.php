<?php

namespace App\Models\WorkflowEngine;

use Illuminate\Database\Eloquent\Model;

class WorkflowAuditEvent extends Model
{
    protected $table = 'workflow_audit_events';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'workflow_definition_id',
        'event_type', 'actor_user_id', 'payload', 'occurred_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'datetime',
    ];
}
