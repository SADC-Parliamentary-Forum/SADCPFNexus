<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowDefinitionVersion extends Model
{
    protected $table = 'workflow_definition_versions';

    protected $fillable = [
        'tenant_id', 'workflow_definition_id', 'version_number', 'status',
        'effective_from', 'effective_to', 'policy_reference',
        'approved_by', 'approved_at', 'published_by', 'published_at',
        'configuration_hash', 'stages_snapshot', 'transitions_snapshot',
        'conditions_snapshot', 'actor_selectors_snapshot', 'sla_snapshot',
        'escalation_snapshot',
    ];

    protected $casts = [
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
        'approved_at' => 'datetime',
        'published_at' => 'datetime',
        'stages_snapshot' => 'array',
        'transitions_snapshot' => 'array',
        'conditions_snapshot' => 'array',
        'actor_selectors_snapshot' => 'array',
        'sla_snapshot' => 'array',
        'escalation_snapshot' => 'array',
    ];

    public function definition(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_definition_id');
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }
}
