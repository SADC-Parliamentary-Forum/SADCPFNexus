<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphTo;
use App\Models\WorkflowEngine\WorkflowApprovalPackage;
use App\Models\WorkflowEngine\WorkflowCertificate;
use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use App\Models\WorkflowEngine\WorkflowTask;

class ApprovalRequest extends Model
{
    protected $fillable = [
        'tenant_id', 'approvable_type', 'approvable_id', 'workflow_id',
        'current_step_index', 'status', 'returned_count',
        'uuid', 'reference', 'definition_version_id', 'record_version',
        'approval_package_hash', 'locked_at', 'submitted_by', 'applicant_id',
        'current_holder_ids', 'current_stage_type', 'due_at', 'escalated_at',
        'held_at', 'sla_paused_at', 'sla_paused_seconds', 'active_parallel_steps',
        'completed_at', 'condition_context', 'idempotency_key',
    ];

    protected $casts = [
        'current_holder_ids' => 'array',
        'active_parallel_steps' => 'array',
        'condition_context' => 'array',
        'locked_at' => 'datetime',
        'due_at' => 'datetime',
        'escalated_at' => 'datetime',
        'held_at' => 'datetime',
        'sla_paused_at' => 'datetime',
        'completed_at' => 'datetime',
    ];

    public function approvable(): MorphTo
    {
        return $this->morphTo();
    }

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflow::class);
    }

    public function definitionVersion(): BelongsTo
    {
        return $this->belongsTo(WorkflowDefinitionVersion::class, 'definition_version_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(ApprovalHistory::class);
    }

    public function delegations(): HasMany
    {
        return $this->hasMany(WorkflowDelegation::class);
    }

    public function tasks(): HasMany
    {
        return $this->hasMany(WorkflowTask::class);
    }

    public function packages(): HasMany
    {
        return $this->hasMany(WorkflowApprovalPackage::class);
    }

    public function certificate(): BelongsTo
    {
        return $this->belongsTo(WorkflowCertificate::class, 'id', 'approval_request_id');
    }

    public function isReturned(): bool { return $this->status === 'returned'; }
    public function isWithdrawn(): bool { return $this->status === 'withdrawn'; }
}
