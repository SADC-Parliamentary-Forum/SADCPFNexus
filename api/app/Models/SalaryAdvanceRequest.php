<?php

namespace App\Models;

use App\Models\Concerns\PreparedOnBehalf;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

class SalaryAdvanceRequest extends Model
{
    use HasFactory, SoftDeletes, PreparedOnBehalf;

    public const DEDUCTION_AUTHORITY_VERSION = 'sa-deduction-auth-v1';

    public const ACTIVE_STATUSES = [
        'submitted',
        'resubmitted',
        'finance_certified',
        'finance_returned',
        'returned_for_correction',
        'approved',
        'approved_for_payment',
        'paid',
        'recovery_scheduled',
        'reconciliation_required',
    ];

    protected $fillable = [
        'tenant_id', 'requester_id', 'approved_by', 'reference_number',
        'advance_type', 'amount', 'approved_amount', 'currency', 'repayment_months',
        'purpose', 'justification', 'status', 'rejection_reason',
        'submitted_at', 'approved_at',
        'payslip_id', 'net_salary_at_request', 'gross_salary_at_request',
        'max_eligible_amount', 'eligibility_status',
        'policy_version_id', 'salary_basis',
        'deduction_authority_confirmed', 'deduction_authority_version',
        'deduction_authority_confirmed_at', 'intended_recovery_payroll_date',
        'finance_certified_at', 'finance_certified_by', 'not_eligible_reason',
        'payment_status', 'paid_at', 'payment_reference', 'payment_method',
        'recovery_status', 'recovered_amount', 'closed_at',
        'prepared_by', 'prepared_on_behalf_of', 'delegated_authority_id',
        // WS2 — consolidation / exception fields (unused in Phase 1)
        'parent_advance_id', 'is_consolidation', 'consolidated_outstanding',
        'new_cash_requested', 'policy_mode', 'is_exception', 'exception_reason',
        'repayment_plan', 'finance_recommendation', 'finance_recommended_by',
        'finance_recommended_at',
    ];

    protected $casts = [
        'submitted_at'                       => 'datetime',
        'approved_at'                        => 'datetime',
        'amount'                             => 'float',
        'approved_amount'                    => 'float',
        'net_salary_at_request'              => 'float',
        'gross_salary_at_request'            => 'float',
        'max_eligible_amount'                => 'float',
        'deduction_authority_confirmed'      => 'boolean',
        'deduction_authority_confirmed_at'   => 'datetime',
        'intended_recovery_payroll_date'     => 'date',
        'finance_certified_at'               => 'datetime',
        'paid_at'                            => 'datetime',
        'recovered_amount'                   => 'float',
        'closed_at'                          => 'datetime',
    ];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requester_id');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function payslip(): BelongsTo
    {
        return $this->belongsTo(Payslip::class);
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvancePolicyVersion::class, 'policy_version_id');
    }

    public function financeCertifiedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'finance_certified_by');
    }

    public function financeReviews(): HasMany
    {
        return $this->hasMany(SalaryAdvanceFinanceReview::class);
    }

    public function reconciliations(): HasMany
    {
        return $this->hasMany(SalaryAdvanceReconciliation::class);
    }

    public function balanceRegister(): MorphOne
    {
        return $this->morphOne(BalanceRegister::class, 'source_request');
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
        return in_array($this->status, ['approved', 'approved_for_payment'], true);
    }

    public function payableAmount(): float
    {
        return (float) ($this->approved_amount ?? $this->amount);
    }

    public function onWorkflowApproved(User $approver): void
    {
        $this->update([
            'status'          => 'approved_for_payment',
            'approved_by'     => $approver->id,
            'approved_at'     => now(),
            'approved_amount' => $this->approved_amount ?? $this->amount,
            'payment_status'  => 'approved_for_payment',
        ]);

        $this->loadMissing('requester');
        if ($this->requester) {
            app(\App\Services\NotificationService::class)->dispatch(
                $this->requester,
                'salary_advance.approved',
                [
                    'name'      => $this->requester->name,
                    'reference' => $this->reference_number,
                    'amount'    => number_format($this->payableAmount(), 2) . ' ' . $this->currency,
                ],
                ['module' => 'salary_advance', 'record_id' => $this->id, 'url' => '/finance/advances/' . $this->id]
            );
        }
        // BCRE register is created on payment — not on approve.
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
                ['module' => 'salary_advance', 'record_id' => $this->id, 'url' => '/finance/advances/' . $this->id]
            );
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
}
