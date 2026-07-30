<?php

namespace App\Models\Documents;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\Storage;

class DocumentFileObject extends Model
{
    protected $table = 'document_file_objects';

    protected $fillable = [
        'tenant_id', 'content_hash', 'storage_disk', 'storage_path', 'mime_type',
        'size_bytes', 'quarantine_status', 'scanned_at', 'scan_provider',
        'scan_summary', 'ref_count',
    ];

    protected function casts(): array
    {
        return [
            'size_bytes' => 'integer',
            'ref_count' => 'integer',
            'scanned_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class, 'file_object_id');
    }

    public function hasCleanScan(): bool
    {
        return $this->quarantine_status === 'clean';
    }

    public function isReleased(): bool
    {
        return $this->hasCleanScan();
    }

    public function existsOnDisk(): bool
    {
        return $this->storage_path
            && Storage::disk($this->storage_disk ?: 'local')->exists($this->storage_path);
    }
}
