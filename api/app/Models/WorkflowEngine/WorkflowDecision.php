<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowDecision extends Model
{
    protected $table = 'workflow_decisions';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'workflow_task_id', 'step_index',
        'stage_type', 'decision_type', 'actor_user_id', 'position_snapshot',
        'department_snapshot', 'authority_snapshot', 'delegation_snapshot',
        'acting_appointment_snapshot', 'record_version', 'approval_package_hash',
        'comments', 'document_signature_event_id', 'authentication_strength',
        'idempotency_key', 'decided_at',
    ];

    protected $casts = [
        'position_snapshot' => 'array',
        'department_snapshot' => 'array',
        'authority_snapshot' => 'array',
        'delegation_snapshot' => 'array',
        'acting_appointment_snapshot' => 'array',
        'decided_at' => 'datetime',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_user_id');
    }
}
