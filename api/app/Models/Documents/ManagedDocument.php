<?php

namespace App\Models\Documents;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class ManagedDocument extends Model
{
    use SoftDeletes;

    protected $table = 'managed_documents';

    protected $fillable = [
        'tenant_id',
        'owner_user_id',
        'title',
        'module',
        'document_type',
        'subject_type',
        'subject_id',
        'current_version_id',
        'is_final',
        'classification',
        'legal_hold',
        'legal_hold_reason',
        'legal_hold_set_by',
        'legal_hold_set_at',
        'retention_policy',
        'retain_until',
        'purged_at',
        'purged_by',
        'archive_class',
        'archive_status',
        'disposal_status',
        'physical_barcode',
        'physical_location',
        'has_physical_original',
        'search_text',
    ];

    protected function casts(): array
    {
        return [
            'is_final' => 'boolean',
            'legal_hold' => 'boolean',
            'legal_hold_set_at' => 'datetime',
            'retain_until' => 'date',
            'purged_at' => 'datetime',
            'has_physical_original' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function legalHoldSetter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'legal_hold_set_by');
    }

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'current_version_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class, 'managed_document_id')->orderBy('version_number');
    }

    public function links(): HasMany
    {
        return $this->hasMany(DocumentLink::class, 'managed_document_id');
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(DocumentAuditEvent::class, 'managed_document_id');
    }

    public function isOnLegalHold(): bool
    {
        return (bool) $this->legal_hold;
    }

    public function isPurged(): bool
    {
        return $this->purged_at !== null;
    }
}
