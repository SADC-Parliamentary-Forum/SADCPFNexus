<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WeeklySummaryRun extends Model
{
    protected $fillable = [
        'tenant_id',
        'period_start',
        'period_end',
        'scheduled_for',
        'started_at',
        'completed_at',
        'status',
        'total_users',
        'total_generated',
        'total_sent',
        'total_failed',
    ];

    protected function casts(): array
    {
        return [
            'period_start'   => 'date',
            'period_end'     => 'date',
            'scheduled_for'  => 'datetime',
            'started_at'     => 'datetime',
            'completed_at'   => 'datetime',
        ];
    }

    public function reports(): HasMany
    {
        return $this->hasMany(WeeklySummaryReport::class, 'run_id');
    }
}
