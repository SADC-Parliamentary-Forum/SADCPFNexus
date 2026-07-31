<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForensicEvidencePackage extends Model
{
    protected $table = 'forensic_evidence_packages';

    protected $fillable = [
        'uuid', 'tenant_id', 'forensic_case_id', 'reference', 'manifest_hash',
        'manifest', 'event_count', 'status', 'created_by', 'sealed_at',
    ];

    protected $casts = [
        'manifest' => 'array',
        'sealed_at' => 'datetime',
    ];

    public function forensicCase(): BelongsTo
    {
        return $this->belongsTo(ForensicCase::class, 'forensic_case_id');
    }
}
