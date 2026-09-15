<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class DocumentOutput extends Model
{
    protected $fillable = [
        'tenant_id', 'subject_type', 'subject_id', 'template_version_id',
        'file_attachment_id', 'data_snapshot', 'workflow_snapshot',
        'document_hash', 'verify_token', 'status', 'generated_at', 'generated_by',
    ];

    protected $casts = [
        'data_snapshot' => 'array',
        'workflow_snapshot' => 'array',
        'generated_at' => 'datetime',
    ];

    public function subject(): MorphTo
    {
        return $this->morphTo();
    }

    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplateVersion::class, 'template_version_id');
    }

    public function fileAttachment(): BelongsTo
    {
        return $this->belongsTo(Attachment::class, 'file_attachment_id');
    }
}
