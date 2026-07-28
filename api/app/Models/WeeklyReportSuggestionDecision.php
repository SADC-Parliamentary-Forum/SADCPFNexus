<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportSuggestionDecision extends Model
{
    protected $fillable = [
        'weekly_report_id', 'source_type', 'source_id', 'decision', 'suggested_section',
        'decided_by', 'decided_at',
    ];

    protected function casts(): array
    {
        return ['decided_at' => 'datetime'];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
