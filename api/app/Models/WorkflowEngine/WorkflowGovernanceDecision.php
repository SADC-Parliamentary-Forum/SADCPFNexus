<?php

namespace App\Models\WorkflowEngine;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowGovernanceDecision extends Model
{
    protected $table = 'workflow_governance_decisions';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'step_index', 'body_name',
        'meeting_reference', 'resolution_reference', 'members_present',
        'quorum_required', 'quorum_met', 'decision', 'voting_result',
        'recorded_by', 'recorder_role', 'chair_user_id', 'minutes_evidence_path',
        'decision_date', 'notes',
    ];

    protected $casts = [
        'quorum_met' => 'boolean',
        'voting_result' => 'array',
        'decision_date' => 'date',
    ];

    public function recorder(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recorded_by');
    }

    /** Decision authority is always the body — never the recorder. */
    public function decisionAuthority(): string
    {
        return (string) $this->body_name;
    }
}
