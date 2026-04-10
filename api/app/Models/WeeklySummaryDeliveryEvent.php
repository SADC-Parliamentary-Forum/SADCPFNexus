<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklySummaryDeliveryEvent extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'report_id',
        'event_type',
        'event_payload',
    ];

    protected function casts(): array
    {
        return [
            'event_payload' => 'array',
            'created_at'    => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklySummaryReport::class, 'report_id');
    }
}
