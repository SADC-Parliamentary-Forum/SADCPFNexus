<?php

namespace App\Models\Documents;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentExternalShare extends Model
{
    protected $table = 'document_external_shares';

    protected $fillable = [
        'tenant_id', 'document_version_id', 'token_hash', 'recipient_email',
        'created_by', 'expires_at', 'max_uses', 'use_count', 'watermark', 'revoked_at',
    ];

    protected function casts(): array
    {
        return [
            'expires_at' => 'datetime',
            'revoked_at' => 'datetime',
            'max_uses' => 'integer',
            'use_count' => 'integer',
            'watermark' => 'boolean',
        ];
    }

    public function version(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function isValid(): bool
    {
        if ($this->revoked_at) {
            return false;
        }
        if ($this->expires_at && $this->expires_at->isPast()) {
            return false;
        }

        return $this->use_count < $this->max_uses;
    }
}
