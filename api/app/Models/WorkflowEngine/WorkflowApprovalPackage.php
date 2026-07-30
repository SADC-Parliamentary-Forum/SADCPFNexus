<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowApprovalPackage extends Model
{
    protected $table = 'workflow_approval_packages';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'package_version', 'package_hash',
        'field_snapshot', 'document_snapshot', 'locked_fields',
        'diff_from_previous', 'created_by', 'locked_at',
    ];

    protected $casts = [
        'field_snapshot' => 'array',
        'document_snapshot' => 'array',
        'locked_fields' => 'array',
        'diff_from_previous' => 'array',
        'locked_at' => 'datetime',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }
}
