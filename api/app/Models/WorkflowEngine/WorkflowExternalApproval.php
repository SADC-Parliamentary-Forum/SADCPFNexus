<?php

namespace App\Models\WorkflowEngine;

use Illuminate\Database\Eloquent\Model;

class WorkflowExternalApproval extends Model
{
    protected $table = 'workflow_external_approvals';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'step_index', 'external_body',
        'external_person', 'decision_date', 'decision', 'evidence_reference',
        'evidence_path', 'notes', 'recorded_by', 'recorded_at',
    ];

    protected $casts = [
        'decision_date' => 'date',
        'recorded_at' => 'datetime',
    ];
}
