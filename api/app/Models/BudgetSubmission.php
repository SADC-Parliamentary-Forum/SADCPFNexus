<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BudgetSubmission extends Model
{
    public const STATUS_DRAFT = 'draft';

    public const STATUS_PENDING_HOD = 'pending_hod';

    public const STATUS_SUBMITTED = 'submitted';

    public const STATUS_RETURNED = 'returned';

    public const STATUS_ACCEPTED = 'accepted';

    public const STATUS_CONSOLIDATED = 'consolidated';

    public const TYPES = ['department', 'programme', 'capital', 'revenue'];

    protected $fillable = [
        'tenant_id',
        'budget_cycle_id',
        'department_id',
        'programme_id',
        'type',
        'title',
        'status',
        'prepared_by',
        'submitted_at',
        'returned_reason',
        'approval_request_id',
        'require_hod_approval',
        'motivation',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'require_hod_approval' => 'boolean',
    ];

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(BudgetCycle::class, 'budget_cycle_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class);
    }

    public function preparer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'prepared_by');
    }

    /** Alias used by WorkflowService::getRequesterFromApprovable */
    public function requester(): BelongsTo
    {
        return $this->preparer();
    }

    public function items(): HasMany
    {
        return $this->hasMany(BudgetSubmissionItem::class)->orderBy('sort_order');
    }

    public function approvalRequest(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class);
    }

    public function onWorkflowApproved(User $actor): void
    {
        $this->update([
            'status' => self::STATUS_SUBMITTED,
            'submitted_at' => $this->submitted_at ?? now(),
        ]);
    }

    public function onWorkflowRejected(User $actor, ?string $reason = null): void
    {
        $this->update([
            'status' => self::STATUS_RETURNED,
            'returned_reason' => $reason ?? 'Rejected by HOD workflow',
        ]);
    }

    public function onWorkflowReturned(User $actor, ?string $reason = null): void
    {
        $this->update([
            'status' => self::STATUS_RETURNED,
            'returned_reason' => $reason,
        ]);
    }

    public function onWorkflowWithdrawn(): void
    {
        $this->update(['status' => self::STATUS_DRAFT]);
    }

    public function onWorkflowResubmitted(): void
    {
        $this->update(['status' => self::STATUS_PENDING_HOD]);
    }

    public function totalRequested(): float
    {
        return (float) $this->items()->sum('requested_amount');
    }
}
