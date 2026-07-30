<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowTask extends Model
{
    protected $table = 'workflow_tasks';

    protected $fillable = [
        'uuid', 'tenant_id', 'approval_request_id', 'step_index', 'stage_type',
        'decision_type', 'assigned_user_id', 'assigned_queue', 'status',
        'assignment_reason', 'actor_resolution_snapshot', 'delegation_id',
        'acting_appointment_id', 'authority_snapshot_id', 'assigned_at',
        'acknowledged_at', 'claimed_at', 'claimed_by', 'due_at', 'reminded_at',
        'escalated_at', 'escalation_level', 'completed_at', 'idempotency_key',
    ];

    protected $casts = [
        'actor_resolution_snapshot' => 'array',
        'assigned_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'claimed_at' => 'datetime',
        'due_at' => 'datetime',
        'reminded_at' => 'datetime',
        'escalated_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    public function assignee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_user_id');
    }

    public function isOverdue(): bool
    {
        return $this->due_at
            && $this->status === 'awaiting'
            && $this->due_at->isPast();
    }
}
