<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportBlocker extends Model
{
    protected $fillable = [
        'weekly_report_id', 'weekly_report_item_id', 'problem', 'impact', 'responsible_party',
        'responsible_user_id', 'action_taken', 'assistance_required', 'severity', 'status',
        'source_type', 'source_id', 'confidentiality', 'include_in_consolidation', 'sequence',
    ];

    protected function casts(): array
    {
        return ['include_in_consolidation' => 'boolean'];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
