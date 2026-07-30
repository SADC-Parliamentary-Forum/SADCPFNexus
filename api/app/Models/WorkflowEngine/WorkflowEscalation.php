<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowEscalation extends Model
{
    protected $table = 'workflow_escalations';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'workflow_task_id', 'type',
        'from_user_id', 'to_user_id', 'reason', 'level',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }
}
