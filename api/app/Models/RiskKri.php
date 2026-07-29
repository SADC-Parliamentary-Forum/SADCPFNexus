<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class RiskKri extends Model
{
    public const STATUSES = ['ok', 'warning', 'breach'];

    protected $fillable = [
        'tenant_id',
        'code',
        'name',
        'description',
        'source_module',
        'source_key',
        'unit',
        'direction',
        'warning_threshold',
        'breach_threshold',
        'risk_id',
        'strategic_objective_id',
        'enabled',
        'last_value',
        'last_status',
        'last_evaluated_at',
    ];

    protected function casts(): array
    {
        return [
            'warning_threshold' => 'float',
            'breach_threshold' => 'float',
            'last_value' => 'float',
            'enabled' => 'boolean',
            'last_evaluated_at' => 'datetime',
        ];
    }

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function strategicObjective(): BelongsTo
    {
        return $this->belongsTo(StrategicObjective::class);
    }

    public function readings(): HasMany
    {
        return $this->hasMany(RiskKriReading::class);
    }
}
