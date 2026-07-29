<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Timesheet extends Model
{
    use HasFactory;

    protected $fillable = [
        'tenant_id', 'period_id', 'user_id', 'week_start', 'week_end', 'week_number',
        'total_hours', 'overtime_hours', 'expected_hours', 'accounted_hours',
        'reconciliation_status', 'status', 'version', 'rejection_reason',
        'returned_at', 'return_reason', 'submitted_at', 'declaration_accepted_at',
        'approved_at', 'approved_by', 'hr_validated_at', 'hr_validated_by',
        'payroll_export_batch_id',
    ];

    protected $casts = [
        'week_start'   => 'date',
        'week_end'     => 'date',
        'submitted_at' => 'datetime',
        'declaration_accepted_at' => 'datetime',
        'approved_at'  => 'datetime',
        'hr_validated_at' => 'datetime',
        'returned_at' => 'datetime',
        'expected_hours' => 'decimal:2',
        'accounted_hours' => 'decimal:2',
    ];

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function period()
    {
        return $this->belongsTo(TimesheetPeriod::class, 'period_id');
    }

    public function days()
    {
        return $this->hasMany(TimesheetDay::class);
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function entries()
    {
        return $this->hasMany(TimesheetEntry::class);
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function onWorkflowApproved(User $approver): void
    {
        $this->update([
            'status'      => 'approved',
            'approved_at' => now(),
            'approved_by' => $approver->id,
        ]);

        /** @var \App\Modules\Timesheets\Services\TimesheetService $svc */
        $svc = app(\App\Modules\Timesheets\Services\TimesheetService::class);
        $svc->onWorkflowApproved($this, $approver);
    }

    public function onWorkflowRejected(User $approver, ?string $reason = null): void
    {
        $this->update([
            'status'           => 'rejected',
            'rejection_reason' => $reason,
        ]);

        /** @var \App\Modules\Timesheets\Services\TimesheetService $svc */
        $svc = app(\App\Modules\Timesheets\Services\TimesheetService::class);
        $svc->onWorkflowRejected($this, $approver, $reason);
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft' || $this->status === 'returned';
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }
}
