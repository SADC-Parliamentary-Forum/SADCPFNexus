<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportAuditEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'tenant_id', 'weekly_report_id', 'period_id', 'actor_id', 'event_type', 'payload', 'ip_address', 'created_at',
    ];

    protected function casts(): array
    {
        return [
            'payload' => 'array',
            'created_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
