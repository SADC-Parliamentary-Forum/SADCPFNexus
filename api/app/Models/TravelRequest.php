<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class TravelRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'purpose', 'status', 'departure_date', 'return_date',
        'destination_country', 'destination_city', 'estimated_dsa',
        'actual_dsa', 'currency', 'justification', 'rejection_reason',
        'workplan_event_id', 'submitted_at', 'approved_at',
    ];

    protected $casts = [
        'departure_date' => 'date',
        'return_date'    => 'date',
        'submitted_at'   => 'datetime',
        'approved_at'    => 'datetime',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function itineraries()
    {
        return $this->hasMany(TravelItinerary::class);
    }

    /** Meeting (workplan event) this travel is for — used for LIL “meetings attended”. */
    public function workplanEvent()
    {
        return $this->belongsTo(WorkplanEvent::class, 'workplan_event_id');
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function onWorkflowApproved(User $approver): void
    {
        app(\App\Modules\Travel\Services\TravelService::class)->onWorkflowApproved($this, $approver);
    }

    public function onWorkflowRejected(User $approver, ?string $reason = null): void
    {
        app(\App\Modules\Travel\Services\TravelService::class)->onWorkflowRejected($this, $approver, $reason);
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
