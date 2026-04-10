<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LeaveRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'leave_type', 'start_date', 'end_date', 'days_requested', 'reason',
        'status', 'rejection_reason', 'has_lil_linking',
        'lil_hours_required', 'lil_hours_linked', 'submitted_at', 'approved_at',
    ];

    protected $casts = [
        'start_date'    => 'date',
        'end_date'      => 'date',
        'submitted_at'  => 'datetime',
        'approved_at'   => 'datetime',
        'has_lil_linking' => 'boolean',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function lilLinkings()
    {
        return $this->hasMany(LeaveLilLinking::class);
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function onWorkflowApproved(User $approver): void
    {
        app(\App\Modules\Leave\Services\LeaveService::class)->onWorkflowApproved($this, $approver);
    }

    public function onWorkflowRejected(User $approver, ?string $reason = null): void
    {
        app(\App\Modules\Leave\Services\LeaveService::class)->onWorkflowRejected($this, $approver, $reason);
    }

    public function attachments(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
}
