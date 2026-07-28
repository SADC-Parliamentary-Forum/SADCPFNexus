<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskAssessment extends Model
{
    protected $fillable = [
        'tenant_id', 'risk_id', 'assessment_type',
        'likelihood', 'impact', 'score', 'level', 'rationale',
        'assessed_by', 'assessed_at', 'superseded_at',
    ];

    protected $casts = [
        'likelihood' => 'integer',
        'impact' => 'integer',
        'score' => 'integer',
        'assessed_at' => 'datetime',
        'superseded_at' => 'datetime',
    ];

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function assessor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assessed_by');
    }

    public function isCurrent(): bool
    {
        return $this->superseded_at === null;
    }
}
