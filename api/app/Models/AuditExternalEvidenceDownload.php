<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditExternalEvidenceDownload extends Model
{
    protected $fillable = [
        'tenant_id', 'external_engagement_id', 'downloaded_by', 'document_label',
        'document_path', 'watermark_applied', 'ip_address',
    ];

    protected $casts = [
        'watermark_applied' => 'boolean',
    ];
}
