<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportPriority extends Model
{
    protected $fillable = [
        'weekly_report_id', 'weekly_report_item_id', 'priority_text', 'intended_result', 'due_date',
        'linked_assignment_id', 'carried_from_priority_id', 'carry_count', 'stale_warning',
        'status', 'source_type', 'source_id', 'confidentiality', 'include_in_consolidation', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'stale_warning' => 'boolean',
            'include_in_consolidation' => 'boolean',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }

    public function carriedFrom(): BelongsTo
    {
        return $this->belongsTo(self::class, 'carried_from_priority_id');
    }
}
