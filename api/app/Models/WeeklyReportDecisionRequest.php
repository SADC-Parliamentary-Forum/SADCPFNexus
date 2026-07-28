<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportDecisionRequest extends Model
{
    protected $fillable = [
        'weekly_report_id', 'weekly_report_item_id', 'decision_requested', 'requested_from',
        'requested_from_user_id', 'deadline', 'impact_if_delayed', 'status', 'decision_recorded',
        'decided_by', 'decided_at', 'follow_up_assignment_id', 'follow_up_risk_id',
        'confidentiality', 'include_in_consolidation', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'deadline' => 'date',
            'decided_at' => 'datetime',
            'include_in_consolidation' => 'boolean',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
