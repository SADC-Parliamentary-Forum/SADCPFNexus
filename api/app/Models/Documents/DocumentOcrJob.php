<?php

namespace App\Models\Documents;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentOcrJob extends Model
{
    protected $table = 'document_ocr_jobs';

    protected $fillable = [
        'tenant_id', 'document_version_id', 'requested_by', 'driver',
        'status', 'extracted_text', 'error_message', 'completed_at',
    ];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
