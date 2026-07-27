<?php
namespace App\Models;

use App\Models\Concerns\PreparedOnBehalf;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class LeaveRequest extends Model
{
    use HasFactory, SoftDeletes, PreparedOnBehalf;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'policy_version_id',
        'leave_type', 'start_date', 'end_date', 'days_requested', 'reason',
        'leave_address', 'contact_number', 'emergency_contact',
        'handover_required', 'handover_notes',
        'status', 'rejection_reason', 'has_lil_linking',
        'current_stage', 'current_holder',
        'recommendation_status', 'recommended_by', 'recommended_at', 'recommendation_comments',
        'certification_status', 'certified_by', 'certified_at', 'certification_comments',
        'lil_hours_required', 'lil_hours_linked', 'submitted_at', 'approved_at',
        'prepared_by', 'prepared_on_behalf_of', 'delegated_authority_id',
    ];

    protected $casts = [
        'start_date'    => 'date',
        'end_date'      => 'date',
        'submitted_at'  => 'datetime',
        'approved_at'   => 'datetime',
        'recommended_at' => 'datetime',
        'certified_at' => 'datetime',
        'has_lil_linking' => 'boolean',
        'handover_required' => 'boolean',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function recommender()
    {
        return $this->belongsTo(User::class, 'recommended_by');
    }

    public function certifier()
    {
        return $this->belongsTo(User::class, 'certified_by');
    }

    public function lilLinkings()
    {
        return $this->hasMany(LeaveLilLinking::class);
    }

    public function policyVersion()
    {
        return $this->belongsTo(LeavePolicyVersion::class, 'policy_version_id');
    }

    public function segments()
    {
        return $this->hasMany(LeaveSegment::class);
    }

    public function payrollImpacts()
    {
        return $this->hasMany(LeavePayrollImpact::class);
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

    public function onWorkflowReturned(User $approver, ?string $comment = null): void
    {
        $this->update(['status' => 'returned_for_correction']);
    }

    public function onWorkflowWithdrawn(): void
    {
        $this->update(['status' => 'withdrawn']);
    }

    public function onWorkflowResubmitted(): void
    {
        $this->update(['status' => 'resubmitted']);
    }

    public function attachments(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
}
