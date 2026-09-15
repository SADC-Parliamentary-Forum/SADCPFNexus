<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentTemplateVersion extends Model
{
    protected $fillable = [
        'tenant_id', 'document_template_id', 'version', 'layout_json',
        'field_catalog_hash', 'status', 'published_at', 'published_by',
    ];

    protected $casts = [
        'layout_json' => 'array',
        'published_at' => 'datetime',
    ];

    public function template(): BelongsTo
    {
        return $this->belongsTo(DocumentTemplate::class, 'document_template_id');
    }

    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
