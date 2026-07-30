<?php

namespace App\Models\Documents;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class DocumentLink extends Model
{
    protected $table = 'document_links';

    protected $fillable = [
        'tenant_id', 'managed_document_id', 'document_version_id',
        'linkable_type', 'linkable_id', 'role', 'label',
        'linked_by', 'unlinked_at', 'unlinked_by',
    ];

    protected function casts(): array
    {
        return [
            'unlinked_at' => 'datetime',
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

    public function version(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'document_version_id');
    }

    public function linkable(): MorphTo
    {
        return $this->morphTo();
    }

    public function linker(): BelongsTo
    {
        return $this->belongsTo(User::class, 'linked_by');
    }

    public function isActive(): bool
    {
        return $this->unlinked_at === null;
    }

    public function scopeActive($query)
    {
        return $query->whereNull('unlinked_at');
    }
}
