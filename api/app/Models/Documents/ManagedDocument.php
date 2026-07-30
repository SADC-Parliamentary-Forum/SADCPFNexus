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
        'subject_type',
        'subject_id',
        'current_version_id',
        'is_final',
        'classification',
    ];

    protected function casts(): array
    {
        return [
            'is_final' => 'boolean',
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

    public function currentVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'current_version_id');
    }

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentVersion::class, 'managed_document_id')->orderBy('version_number');
    }

    public function auditEvents(): HasMany
    {
        return $this->hasMany(DocumentAuditEvent::class, 'managed_document_id');
    }
}
