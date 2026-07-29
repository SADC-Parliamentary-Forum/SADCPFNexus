<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskDependency extends Model
{
    public const TYPES = ['depends_on', 'related_to'];

    protected $fillable = [
        'tenant_id', 'risk_id', 'related_risk_id', 'relation_type', 'notes', 'created_by',
    ];

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class, 'risk_id');
    }

    public function relatedRisk(): BelongsTo
    {
        return $this->belongsTo(Risk::class, 'related_risk_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
