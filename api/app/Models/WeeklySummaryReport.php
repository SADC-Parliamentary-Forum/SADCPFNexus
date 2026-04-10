<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WeeklySummaryReport extends Model
{
    protected $fillable = [
        'run_id',
        'tenant_id',
        'user_id',
        'scope_type',
        'period_start',
        'period_end',
        'payload',
        'payload_hash',
        'template_version',
        'status',
        'sent_at',
        'failure_reason',
    ];

    protected function casts(): array
    {
        return [
            'payload'      => 'array',
            'period_start' => 'date',
            'period_end'   => 'date',
            'sent_at'      => 'datetime',
        ];
    }

    public function run(): BelongsTo
    {
        return $this->belongsTo(WeeklySummaryRun::class, 'run_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function deliveryEvents(): HasMany
    {
        return $this->hasMany(WeeklySummaryDeliveryEvent::class, 'report_id');
    }
}
