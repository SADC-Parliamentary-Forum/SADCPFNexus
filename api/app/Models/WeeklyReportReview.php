<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportReview extends Model
{
    protected $fillable = [
        'weekly_report_id', 'reviewer_id', 'action', 'comment_type', 'comments',
        'section_or_item', 'correction_requested', 'resubmission_due_date',
        'is_confidential', 'report_version',
    ];

    protected function casts(): array
    {
        return [
            'resubmission_due_date' => 'date',
            'is_confidential' => 'boolean',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }
}
