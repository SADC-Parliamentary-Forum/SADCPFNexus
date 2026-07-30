<?php

namespace App\Models\Documents;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class DocumentVersion extends Model
{
    protected $table = 'document_versions';

    public const STATUS_ACTIVE = 'active';
    public const STATUS_IMMUTABLE = 'immutable';
    public const STATUS_FINAL = 'final';

    protected $fillable = [
        'tenant_id',
        'managed_document_id',
        'version_number',
        'content_hash',
        'storage_disk',
        'storage_path',
        'original_filename',
        'mime_type',
        'size_bytes',
        'quarantine_status',
        'scanned_at',
        'scan_provider',
        'status',
        'is_immutable',
        'uploaded_by',
        'finalized_at',
        'finalized_by',
        'signed_locked_at',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'version_number' => 'integer',
            'size_bytes' => 'integer',
            'is_immutable' => 'boolean',
            'scanned_at' => 'datetime',
            'finalized_at' => 'datetime',
            'signed_locked_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function document(): BelongsTo
    {
        return $this->belongsTo(ManagedDocument::class, 'managed_document_id');
    }

    public function uploader(): BelongsTo
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }

    public function downloadTokens(): HasMany
    {
        return $this->hasMany(DocumentDownloadToken::class, 'document_version_id');
    }

    public function isLocked(): bool
    {
        return $this->is_immutable
            || in_array($this->status, [self::STATUS_IMMUTABLE, self::STATUS_FINAL], true);
    }

    public function existsOnDisk(): bool
    {
        return $this->storage_path
            && Storage::disk($this->storage_disk ?: 'local')->exists($this->storage_path);
    }
}
