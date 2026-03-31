<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class ProcurementRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'title', 'description', 'category', 'estimated_value', 'currency',
        'procurement_method', 'status', 'budget_line', 'justification',
        'rejection_reason', 'required_by_date', 'submitted_at', 'approved_at',
    ];

    protected $casts = [
        'required_by_date' => 'date',
        'submitted_at'     => 'datetime',
        'approved_at'      => 'datetime',
    ];

    public function requester() { return $this->belongsTo(User::class, 'requester_id'); }
    public function approver()  { return $this->belongsTo(User::class, 'approved_by'); }
    public function items()     { return $this->hasMany(ProcurementItem::class); }
    public function quotes()    { return $this->hasMany(ProcurementQuote::class); }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function isDraft(): bool     { return $this->status === 'draft'; }
    public function isSubmitted(): bool { return $this->status === 'submitted'; }
    public function isApproved(): bool  { return $this->status === 'approved'; }

    public function onWorkflowApproved(User $approver): void
    {
        $this->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        // Notify the requester
        $this->loadMissing('requester');
        if ($this->requester) {
            app(\App\Services\NotificationService::class)->dispatch(
                $this->requester,
                'procurement.approved',
                ['name' => $this->requester->name, 'reference' => $this->reference_number],
                ['module' => 'procurement', 'record_id' => $this->id, 'url' => '/procurement/' . $this->id]
            );
        }
    }

    public function onWorkflowRejected(User $approver, ?string $reason): void
    {
        $this->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        // Notify the requester
        $this->loadMissing('requester');
        if ($this->requester) {
            app(\App\Services\NotificationService::class)->dispatch(
                $this->requester,
                'procurement.rejected',
                ['name' => $this->requester->name, 'reference' => $this->reference_number, 'comment' => $reason ?? ''],
                ['module' => 'procurement', 'record_id' => $this->id, 'url' => '/procurement/' . $this->id]
            );
        }
    }
}
