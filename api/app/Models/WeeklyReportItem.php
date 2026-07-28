<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportItem extends Model
{
    protected $fillable = [
        'weekly_report_id', 'section_type', 'title', 'narrative', 'sequence',
        'source_type', 'source_id', 'source_reference_snapshot', 'source_status_snapshot',
        'result_or_expected_outcome', 'due_date', 'priority', 'confidentiality',
        'include_in_consolidation', 'status', 'structured',
    ];

    protected function casts(): array
    {
        return [
            'due_date' => 'date',
            'include_in_consolidation' => 'boolean',
            'structured' => 'array',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
