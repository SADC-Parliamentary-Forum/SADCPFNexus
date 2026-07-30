<?php

namespace App\Models\Documents;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DocumentDerivative extends Model
{
    protected $table = 'document_derivatives';

    protected $fillable = [
        'tenant_id', 'source_version_id', 'derivative_version_id', 'kind', 'status', 'payload',
    ];

    protected function casts(): array
    {
        return ['payload' => 'array'];
    }

    public function source(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'source_version_id');
    }

    public function derivativeVersion(): BelongsTo
    {
        return $this->belongsTo(DocumentVersion::class, 'derivative_version_id');
    }
}
