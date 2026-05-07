<?php
namespace App\Models;

use App\Modules\Finance\Services\BalanceRegisterService;
use App\Services\NotificationService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ImprestRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'budget_line', 'amount_requested', 'amount_approved', 'amount_liquidated',
        'currency', 'expected_liquidation_date', 'purpose', 'justification',
        'status', 'rejection_reason', 'submitted_at', 'approved_at', 'liquidated_at',
    ];

    protected $casts = [
        'expected_liquidation_date' => 'date',
        'submitted_at'  => 'datetime',
        'approved_at'   => 'datetime',
        'liquidated_at' => 'datetime',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function approvalRequest()
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function attachments()
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function onWorkflowApproved(User $approver): void
    {
        $this->update([
            'status'          => 'approved',
            'approved_by'     => $approver->id,
            'amount_approved' => $this->amount_approved ?? $this->amount_requested,
            'approved_at'     => now(),
        ]);

        $this->loadMissing('requester');
        if ($this->requester) {
            app(NotificationService::class)->dispatch($this->requester, 'imprest.approved', [
                'name'      => $this->requester->name,
                'reference' => $this->reference_number,
                'amount'    => number_format($this->amount_approved ?? $this->amount_requested, 2) . ' ' . $this->currency,
            ], ['module' => 'imprest', 'record_id' => $this->id, 'url' => '/imprest/' . $this->id]);
        }

        try {
            app(BalanceRegisterService::class)->createFromImprest($this->fresh(), $approver);
        } catch (\Throwable) {}
    }

    public function onWorkflowRejected(User $approver, ?string $reason = null): void
    {
        $this->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        $this->loadMissing('requester');
        if ($this->requester) {
            app(NotificationService::class)->dispatch($this->requester, 'imprest.rejected', [
                'name'      => $this->requester->name,
                'reference' => $this->reference_number,
                'comment'   => $reason,
            ], ['module' => 'imprest', 'record_id' => $this->id, 'url' => '/imprest/' . $this->id]);
        }
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

    public function isDraft(): bool { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool { return $this->status === 'approved'; }
    public function isReturnedForCorrection(): bool { return $this->status === 'returned_for_correction'; }
    public function isResubmitted(): bool { return $this->status === 'resubmitted'; }
}
