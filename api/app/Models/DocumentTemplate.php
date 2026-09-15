<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class DocumentTemplate extends Model
{
    protected $fillable = [
        'tenant_id', 'document_type', 'name', 'description',
        'page_size', 'orientation', 'status', 'is_default',
        'matching_rules', 'created_by',
    ];

    protected $casts = [
        'is_default' => 'boolean',
        'matching_rules' => 'array',
    ];

    public function versions(): HasMany
    {
        return $this->hasMany(DocumentTemplateVersion::class)->orderByDesc('version');
    }

    public function draftVersion(): HasOne
    {
        return $this->hasOne(DocumentTemplateVersion::class)->ofMany(
            ['version' => 'max'],
            fn ($q) => $q->where('status', 'draft')
        );
    }

    public function publishedVersion(): HasOne
    {
        return $this->hasOne(DocumentTemplateVersion::class)->ofMany(
            ['version' => 'max'],
            fn ($q) => $q->where('status', 'published')
        );
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
