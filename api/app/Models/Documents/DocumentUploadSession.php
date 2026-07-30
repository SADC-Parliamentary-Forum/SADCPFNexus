<?php

namespace App\Models\Documents;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentUploadSession extends Model
{
    protected $table = 'document_upload_sessions';

    protected $fillable = [
        'tenant_id', 'created_by', 'session_uuid', 'original_filename', 'mime_type',
        'declared_size', 'chunk_size', 'total_chunks', 'received_chunks',
        'temp_path', 'status', 'meta', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'declared_size' => 'integer',
            'chunk_size' => 'integer',
            'total_chunks' => 'integer',
            'received_chunks' => 'integer',
            'meta' => 'array',
            'expires_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function isExpired(): bool
    {
        return $this->expires_at !== null && $this->expires_at->isPast();
    }
}
