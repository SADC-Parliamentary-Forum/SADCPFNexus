<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskBcpExercise extends Model
{
    public const PLANNED = 'planned';
    public const IN_PROGRESS = 'in_progress';
    public const COMPLETED = 'completed';
    public const CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id',
        'risk_id',
        'bcp_link_id',
        'title',
        'exercise_type',
        'status',
        'scheduled_at',
        'completed_at',
        'result',
        'outcome_notes',
        'facilitator_id',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'scheduled_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function bcpLink(): BelongsTo
    {
        return $this->belongsTo(RiskBcpLink::class, 'bcp_link_id');
    }
}
