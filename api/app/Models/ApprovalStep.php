<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Spatie\Permission\Models\Role;

class ApprovalStep extends Model
{
    protected $table = 'approval_workflow_steps';

    protected $fillable = [
        'workflow_id', 'step_order', 'step_name', 'stage_type', 'approver_type',
        'actor_selector', 'actor_selector_config', 'authority_action',
        'amount_threshold', 'currency', 'condition_expression',
        'skip_if_condition_false', 'requires_signature',
        'role_id', 'user_id',
        'allow_return', 'allow_reject', 'allow_delegate', 'sla_hours', 'requires_comment',
        'escalation_hours', 'escalation_to_selector', 'reminder_hours', 'decision_meanings',
        'completion_rule', 'quorum_count', 'quorum_percentage', 'parallel_group',
        'parallel_role_key', 'sod_segregated', 'governance_body_name',
        'routing_strategy', 'sla_calendar_code', 'sla_priority_variant',
        'pause_sla_on_hold', 'high_risk',
    ];

    protected $casts = [
        'actor_selector_config' => 'array',
        'condition_expression' => 'array',
        'decision_meanings' => 'array',
        'skip_if_condition_false' => 'boolean',
        'requires_signature' => 'boolean',
        'allow_return' => 'boolean',
        'allow_reject' => 'boolean',
        'allow_delegate' => 'boolean',
        'requires_comment' => 'boolean',
        'sod_segregated' => 'boolean',
        'pause_sla_on_hold' => 'boolean',
        'high_risk' => 'boolean',
        'amount_threshold' => 'decimal:2',
    ];

    public function workflow(): BelongsTo
    {
        return $this->belongsTo(ApprovalWorkflow::class, 'workflow_id');
    }

    public function role(): BelongsTo
    {
        return $this->belongsTo(Role::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
