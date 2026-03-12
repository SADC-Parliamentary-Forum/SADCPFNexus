<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PerformanceTracker extends Model
{
    protected $fillable = [
        'tenant_id', 'employee_id', 'supervisor_id', 'cycle_start', 'cycle_end',
        'status', 'trend', 'output_score', 'timeliness_score', 'quality_score',
        'workload_score', 'update_compliance_score', 'development_progress_score',
        'recognition_indicator', 'conduct_risk_indicator', 'overdue_task_count',
        'blocked_task_count', 'completed_task_count', 'assignment_completion_rate',
        'average_closure_delay_days', 'timesheet_hours_logged', 'commendation_count',
        'disciplinary_case_count', 'active_warning_flag', 'active_development_action_count',
        'probation_flag', 'hr_attention_required', 'management_attention_required',
        'supervisor_summary', 'hr_summary', 'last_recalculated_at',
    ];

    protected function casts(): array
    {
        return [
            'cycle_start' => 'date',
            'cycle_end' => 'date',
            'recognition_indicator' => 'boolean',
            'conduct_risk_indicator' => 'boolean',
            'active_warning_flag' => 'boolean',
            'probation_flag' => 'boolean',
            'hr_attention_required' => 'boolean',
            'management_attention_required' => 'boolean',
            'last_recalculated_at' => 'datetime',
        ];
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function supervisor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'supervisor_id');
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
