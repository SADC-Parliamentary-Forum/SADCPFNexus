<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskKriReading extends Model
{
    protected $fillable = [
        'tenant_id',
        'risk_kri_id',
        'value',
        'status',
        'evaluated_at',
        'meta',
        'breach_notified_at',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'float',
            'evaluated_at' => 'datetime',
            'breach_notified_at' => 'datetime',
            'meta' => 'array',
        ];
    }

    public function kri(): BelongsTo
    {
        return $this->belongsTo(RiskKri::class, 'risk_kri_id');
    }
}
