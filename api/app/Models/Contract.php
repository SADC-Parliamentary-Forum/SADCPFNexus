<?php

namespace App\Models;

use App\Modules\Contracts\Services\ContractNumberAllocator;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;
use Illuminate\Database\Eloquent\SoftDeletes;

/**
 * Contract — a live institutional business object spanning preparation,
 * approval, signature, performance, payment, amendment and close-out.
 */
class Contract extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'origin_type', 'origin_reference',
        'is_framework', 'framework_ceiling', 'parent_contract_id',
        'procurement_request_id', 'tender_id', 'type_id', 'vendor_id', 'purchase_order_id',
        'counterparty_type', 'counterparty_name',
        'department_id', 'contract_owner_id', 'procurement_officer_id',
        'programme_id', 'project_id', 'donor', 'funding_source_id', 'funding_source',
        'procurement_method', 'award_reference', 'tor_reference', 'short_description',
        'reference_number', 'title', 'description',
        'start_date', 'end_date',
        'preparation_date', 'agreement_date', 'effective_date', 'service_start_date',
        'service_end_date', 'signature_deadline', 'renewal_decision_date',
        'notice_period_days', 'closeout_target_date',
        'renewal_type', 'auto_renew', 'renewals_count',
        'value', 'original_value', 'current_value', 'ceiling_value',
        'rate', 'rate_basis', 'units',
        'currency', 'budget_currency', 'conversion_reference', 'converted_value',
        'budget_line', 'scope',
        'template_version_id', 'current_document_version_id',
        'status', 'contract_status', 'signature_status', 'health_status', 'is_legacy',
        'signed_at', 'terminated_at', 'termination_reason', 'closed_at',
        'created_by',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'preparation_date' => 'date',
        'agreement_date' => 'date',
        'effective_date' => 'date',
        'service_start_date' => 'date',
        'service_end_date' => 'date',
        'signature_deadline' => 'date',
        'renewal_decision_date' => 'date',
        'closeout_target_date' => 'date',
        'signed_at' => 'datetime',
        'terminated_at' => 'datetime',
        'closed_at' => 'datetime',
        'value' => 'decimal:2',
        'original_value' => 'decimal:2',
        'current_value' => 'decimal:2',
        'ceiling_value' => 'decimal:2',
        'rate' => 'decimal:2',
        'units' => 'decimal:2',
        'converted_value' => 'decimal:2',
        'notice_period_days' => 'integer',
        'renewals_count' => 'integer',
        'auto_renew' => 'boolean',
        'is_framework' => 'boolean',
        'framework_ceiling' => 'decimal:2',
        'is_legacy' => 'boolean',
        'scope' => 'array',
    ];

    protected $appends = ['is_expired', 'is_expiring_soon', 'display_counterparty'];

    protected static function booted(): void
    {
        static::creating(function (self $c): void {
            if (empty($c->reference_number)) {
                $c->reference_number = app(ContractNumberAllocator::class)->allocate((int) $c->tenant_id);
            }
            if (empty($c->contract_status)) {
                $c->contract_status = 'DRAFT';
            }
            if (empty($c->status)) {
                $c->status = 'draft';
            }
            if ($c->original_value === null) {
                $c->original_value = $c->value;
            }
            if ($c->current_value === null) {
                $c->current_value = $c->value;
            }
        });
    }

    // ── Relations ─────────────────────────────────────────────────────────────

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function tender(): BelongsTo
    {
        return $this->belongsTo(Tender::class);
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(ContractType::class, 'type_id');
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class);
    }

    public function fundingSource(): BelongsTo
    {
        return $this->belongsTo(FundingSource::class);
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function contractOwner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'contract_owner_id');
    }

    public function procurementOfficer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'procurement_officer_id');
    }

    public function templateVersion(): BelongsTo
    {
        return $this->belongsTo(ContractTemplateVersion::class, 'template_version_id');
    }

    public function currentDocumentVersion(): BelongsTo
    {
        return $this->belongsTo(ContractDocumentVersion::class, 'current_document_version_id');
    }

    public function milestones(): HasMany
    {
        return $this->hasMany(ContractMilestone::class)->orderBy('sort_order')->orderBy('id');
    }

    public function parties(): HasMany
    {
        return $this->hasMany(ContractParty::class);
    }

    public function counterparty(): HasOne
    {
        return $this->hasOne(ContractParty::class)->where('party_role', 'counterparty');
    }

    public function fundingSources(): HasMany
    {
        return $this->hasMany(ContractFundingSource::class);
    }

    public function deliverables(): HasMany
    {
        return $this->hasMany(ContractDeliverable::class)->orderBy('number');
    }

    public function obligations(): HasMany
    {
        return $this->hasMany(ContractObligation::class);
    }

    public function paymentSchedules(): HasMany
    {
        return $this->hasMany(ContractPaymentSchedule::class)->orderBy('sort_order')->orderBy('id');
    }

    public function documentVersions(): HasMany
    {
        return $this->hasMany(ContractDocumentVersion::class)->orderByDesc('version');
    }

    public function signatories(): HasMany
    {
        return $this->hasMany(ContractSignatory::class)->orderBy('sign_order');
    }

    public function amendments(): HasMany
    {
        return $this->hasMany(ContractAmendment::class)->orderBy('sequence');
    }

    public function exceptions(): HasMany
    {
        return $this->hasMany(ContractException::class)->orderByDesc('created_at');
    }

    public function complianceDocuments(): HasMany
    {
        return $this->hasMany(ContractComplianceDocument::class);
    }

    public function disputes(): HasMany
    {
        return $this->hasMany(ContractDispute::class)->orderByDesc('date_raised');
    }

    public function keyPersonnel(): HasMany
    {
        return $this->hasMany(ContractKeyPersonnel::class)->orderBy('status')->orderBy('name');
    }

    public function invoices(): HasMany
    {
        return $this->hasMany(Invoice::class)->orderByDesc('invoice_date');
    }

    public function suspensions(): HasMany
    {
        return $this->hasMany(ContractSuspension::class)->orderByDesc('id');
    }

    public function terminations(): HasMany
    {
        return $this->hasMany(ContractTermination::class)->orderByDesc('id');
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(ContractExtension::class)->orderByDesc('id');
    }

    public function renewals(): HasMany
    {
        return $this->hasMany(ContractRenewal::class)->orderByDesc('id');
    }

    public function clauseAssignments(): HasMany
    {
        return $this->hasMany(ContractClauseAssignment::class)->orderBy('sort_order')->orderBy('id');
    }

    public function parentContract(): BelongsTo
    {
        return $this->belongsTo(Contract::class, 'parent_contract_id');
    }

    public function callOffs(): HasMany
    {
        return $this->hasMany(Contract::class, 'parent_contract_id')->orderBy('id');
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    // ── Accessors ─────────────────────────────────────────────────────────────

    public function getIsExpiredAttribute(): bool
    {
        return $this->end_date && $this->end_date->isPast();
    }

    public function getIsExpiringSoonAttribute(): bool
    {
        return $this->end_date
            && ! $this->end_date->isPast()
            && $this->end_date->diffInDays(now()) <= 30;
    }

    public function getDisplayCounterpartyAttribute(): ?string
    {
        if ($this->counterparty_name) {
            return $this->counterparty_name;
        }
        if ($this->relationLoaded('vendor') && $this->vendor) {
            return $this->vendor->name;
        }

        return null;
    }

    // ── Status helpers ──────────────────────────────────────────────────────

    public function lifecycle(): string
    {
        return $this->contract_status ?? strtoupper((string) $this->status);
    }

    public function isDraft(): bool
    {
        return $this->lifecycle() === 'DRAFT';
    }

    public function isActive(): bool
    {
        return $this->lifecycle() === 'ACTIVE';
    }

    public function isFullyExecuted(): bool
    {
        return $this->lifecycle() === 'FULLY_EXECUTED';
    }

    public function isClosed(): bool
    {
        return $this->lifecycle() === 'CLOSED';
    }

    public function isExpired(): bool
    {
        return $this->is_expired;
    }

    /** Content is immutable once any signature has been captured. */
    public function isSignatureLocked(): bool
    {
        return in_array($this->signature_status, ['partially_signed', 'signed'], true)
            || in_array($this->lifecycle(), ['PARTIALLY_SIGNED', 'FULLY_EXECUTED', 'ACTIVE', 'COMPLETED', 'CLOSING', 'CLOSED'], true);
    }

    // ── Workflow engine hooks (invoked by WorkflowService::finalizeApprovable) ──

    public function onWorkflowApproved(User $actor): void
    {
        // Approval authorises signature; the signature workflow (WS4) follows.
        $this->update(['contract_status' => 'APPROVED_FOR_SIGNATURE', 'status' => 'draft']);
    }

    public function onWorkflowRejected(User $actor, ?string $reason = null): void
    {
        $this->update(['contract_status' => 'REJECTED']);
    }

    public function onWorkflowReturned(User $actor, ?string $reason = null): void
    {
        // Returned contracts remain with the creator for correction.
        $this->update(['contract_status' => 'CHANGES_REQUESTED']);
    }

    public function onWorkflowWithdrawn(): void
    {
        $this->update(['contract_status' => 'DRAFT']);
    }
}
