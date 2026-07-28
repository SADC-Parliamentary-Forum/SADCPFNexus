<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportDeadlineChange extends Model
{
    protected $fillable = [
        'weekly_report_id', 'previous_due_at', 'new_due_at', 'reason', 'changed_by',
    ];

    protected function casts(): array
    {
        return [
            'previous_due_at' => 'datetime',
            'new_due_at' => 'datetime',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
