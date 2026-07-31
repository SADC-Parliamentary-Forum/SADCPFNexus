<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ForensicCase extends Model
{
    protected $table = 'forensic_cases';

    protected $fillable = [
        'tenant_id', 'uuid', 'reference', 'title', 'status', 'opened_by',
        'notes', 'custody_holder_id', 'custody_notes', 'closed_at', 'closed_by',
    ];

    protected $casts = [
        'closed_at' => 'datetime',
    ];

    public function events(): HasMany
    {
        return $this->hasMany(ForensicCaseEvent::class, 'forensic_case_id');
    }

    public function packages(): HasMany
    {
        return $this->hasMany(ForensicEvidencePackage::class, 'forensic_case_id');
    }

    public function opener(): BelongsTo
    {
        return $this->belongsTo(\App\Models\User::class, 'opened_by');
    }
}
