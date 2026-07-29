<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditEvidenceResponse extends Model
{
    protected $fillable = [
        'tenant_id', 'evidence_request_id', 'responded_by', 'response_text', 'attachment_path',
    ];
}
