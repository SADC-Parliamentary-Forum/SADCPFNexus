<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportRisk extends Model
{
    protected $fillable = [
        'weekly_report_id', 'emerging_issue', 'possible_impact', 'immediate_mitigation',
        'escalate_to_risk_register', 'linked_risk_id', 'status', 'confidentiality',
        'include_in_consolidation', 'sequence',
    ];

    protected function casts(): array
    {
        return [
            'escalate_to_risk_register' => 'boolean',
            'include_in_consolidation' => 'boolean',
        ];
    }

    public function report(): BelongsTo
    {
        return $this->belongsTo(WeeklyReport::class, 'weekly_report_id');
    }
}
