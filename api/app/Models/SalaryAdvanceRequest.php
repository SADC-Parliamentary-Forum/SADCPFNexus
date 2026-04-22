<?php

namespace App\Models;

use App\Modules\Finance\Services\BalanceRegisterService;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Facades\Log;

class SalaryAdvanceRequest extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'advance_type', 'amount', 'currency', 'repayment_months',
        'purpose', 'justification', 'status', 'rejection_reason',
        'submitted_at', 'approved_at',
    ];

    protected $casts = [
        'submitted_at' => 'datetime',
        'approved_at'  => 'datetime',
        'amount'       => 'float',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver()
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function isDraft(): bool
    {
        return $this->status === 'draft';
    }

    public function isSubmitted(): bool
    {
        return $this->status === 'submitted';
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function onWorkflowApproved(User $approver): void
    {
        $this->update([
            'status'      => 'approved',
            'approved_by' => $approver->id,
            'approved_at' => now(),
        ]);

        $this->loadMissing('requester');
        if ($this->requester) {
            app(\App\Services\NotificationService::class)->dispatch(
                $this->requester,
                'salary_advance.approved',
                [
                    'name'      => $this->requester->name,
                    'reference' => $this->reference_number,
                    'amount'    => number_format((float) $this->amount, 2) . ' ' . $this->currency,
                ],
                ['module' => 'salary_advance', 'record_id' => $this->id, 'url' => '/finance/salary-advance/' . $this->id]
            );
        }

        try {
            app(BalanceRegisterService::class)->createFromSalaryAdvance($this, $approver);
        } catch (\Throwable $e) {
            Log::error('BCRE register creation failed for salary advance', [
                'advance_id' => $this->id,
                'error'      => $e->getMessage(),
            ]);
        }
    }

    public function onWorkflowRejected(User $approver, ?string $reason): void
    {
        $this->update([
            'status'           => 'rejected',
            'approved_by'      => $approver->id,
            'rejection_reason' => $reason,
        ]);

        $this->loadMissing('requester');
        if ($this->requester) {
            app(\App\Services\NotificationService::class)->dispatch(
                $this->requester,
                'salary_advance.rejected',
                [
                    'name'      => $this->requester->name,
                    'reference' => $this->reference_number,
                    'comment'   => $reason ?? '',
                ],
                ['module' => 'salary_advance', 'record_id' => $this->id, 'url' => '/finance/salary-advance/' . $this->id]
            );
        }
    }
}
