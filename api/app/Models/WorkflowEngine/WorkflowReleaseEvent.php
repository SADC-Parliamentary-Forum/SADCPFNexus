<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowReleaseEvent extends Model
{
    protected $table = 'workflow_release_events';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'event_type', 'target', 'status',
        'attempts', 'next_retry_at', 'last_error', 'payload',
        'idempotency_key', 'succeeded_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'next_retry_at' => 'datetime',
        'succeeded_at' => 'datetime',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }
}
