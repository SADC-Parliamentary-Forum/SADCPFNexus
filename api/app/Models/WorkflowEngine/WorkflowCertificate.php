<?php

namespace App\Models\WorkflowEngine;

use App\Models\ApprovalRequest;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowCertificate extends Model
{
    protected $table = 'workflow_certificates';

    protected $fillable = [
        'uuid', 'tenant_id', 'approval_request_id', 'certificate_hash',
        'certificate_body', 'issued_at',
    ];

    protected $casts = [
        'certificate_body' => 'array',
        'issued_at' => 'datetime',
    ];

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }
}
