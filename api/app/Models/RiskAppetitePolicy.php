<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskAppetitePolicy extends Model
{
    protected $fillable = [
        'tenant_id', 'version', 'title', 'effective_from', 'effective_to',
        'matrix_thresholds', 'acceptance_authority', 'tolerance_statement',
        'is_active', 'created_by',
    ];

    protected $casts = [
        'matrix_thresholds' => 'array',
        'acceptance_authority' => 'array',
        'effective_from' => 'date',
        'effective_to' => 'date',
        'is_active' => 'boolean',
        'version' => 'integer',
    ];

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public static function defaultThresholds(): array
    {
        return ['low_max' => 5, 'medium_max' => 10, 'high_max' => 15];
    }

    public static function defaultAuthority(): array
    {
        return [
            'low' => ['Risk Owner', 'HOD', 'Director', 'Governance Officer', 'Secretary General'],
            'medium' => ['HOD', 'Director', 'Governance Officer', 'Secretary General'],
            'high' => ['Director', 'Governance Officer', 'Secretary General'],
            'critical' => ['Director', 'Secretary General', 'Governance Officer'],
        ];
    }

    public function levelForScore(int $score): string
    {
        $t = $this->matrix_thresholds ?: static::defaultThresholds();

        return match (true) {
            $score > (int) ($t['high_max'] ?? 15) => 'critical',
            $score > (int) ($t['medium_max'] ?? 10) => 'high',
            $score > (int) ($t['low_max'] ?? 5) => 'medium',
            default => 'low',
        };
    }
}
