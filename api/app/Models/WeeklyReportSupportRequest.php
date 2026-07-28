<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportSupportRequest extends Model
{
    protected $fillable = [
        'weekly_report_id', 'department_or_person', 'support_needed', 'required_date',
        'status', 'confidentiality', 'include_in_consolidation', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'required_date' => 'date',
            'include_in_consolidation' => 'boolean',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
