<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;
use Illuminate\Database\Eloquent\Relations\MorphOne;

class Vendor extends Model
{
    public const STATUS_DRAFT = 'draft';
    public const STATUS_SUBMITTED = 'submitted';
    public const STATUS_UNDER_REVIEW = 'under_review';
    public const STATUS_CORRECTION_REQUIRED = 'correction_required';
    public const STATUS_CONDITIONALLY_APPROVED = 'conditionally_approved';
    public const STATUS_APPROVED = 'approved';
    public const STATUS_COMPLIANCE_WARNING = 'compliance_warning';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_SUSPENDED = 'suspended';
    public const STATUS_DEBARRED = 'debarred';
    public const STATUS_REJECTED = 'rejected';
    public const STATUS_ARCHIVED = 'archived';

    public const STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SUBMITTED,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_CORRECTION_REQUIRED,
        self::STATUS_CONDITIONALLY_APPROVED,
        self::STATUS_APPROVED,
        self::STATUS_COMPLIANCE_WARNING,
        self::STATUS_EXPIRED,
        self::STATUS_SUSPENDED,
        self::STATUS_DEBARRED,
        self::STATUS_REJECTED,
        self::STATUS_ARCHIVED,
    ];

    public const LEGACY_STATUS_MAP = [
        'pending_approval' => self::STATUS_SUBMITTED,
        'blacklisted' => self::STATUS_DEBARRED,
    ];

    public const PORTAL_LOGIN_STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SUBMITTED,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_CORRECTION_REQUIRED,
        self::STATUS_CONDITIONALLY_APPROVED,
        self::STATUS_APPROVED,
        self::STATUS_COMPLIANCE_WARNING,
    ];

    public const REGISTRATION_ELIGIBLE_STATUSES = [
        self::STATUS_APPROVED,
        self::STATUS_CONDITIONALLY_APPROVED,
        self::STATUS_COMPLIANCE_WARNING,
    ];

    public const PENDING_REVIEW_STATUSES = [
        self::STATUS_DRAFT,
        self::STATUS_SUBMITTED,
        self::STATUS_UNDER_REVIEW,
        self::STATUS_CORRECTION_REQUIRED,
    ];

    public const INACTIVE_STATUSES = [
        self::STATUS_REJECTED,
        self::STATUS_SUSPENDED,
        self::STATUS_DEBARRED,
        self::STATUS_EXPIRED,
        self::STATUS_ARCHIVED,
    ];

    protected $fillable = [
        'tenant_id', 'supplier_type', 'name', 'trading_name', 'incorporation_date', 'business_type',
        'contact_name', 'registration_number', 'tax_number',
        'contact_email', 'contact_phone', 'contacts', 'website', 'address', 'postal_address',
        'country', 'geographic_coverage', 'years_experience', 'experience_summary', 'category',
        'payment_terms', 'bank_name', 'bank_account', 'bank_branch',
        'finance_verified_at', 'finance_verified_by', 'critical_fields_locked_at',
        'is_approved', 'is_active', 'status', 'risk_level', 'submitted_at', 'is_sme', 'notes',
        'rejection_reason', 'approved_at', 'approved_by',
        'rejected_at', 'rejected_by', 'suspended_at', 'suspension_reason', 'last_info_request_reason',
        'is_blacklisted', 'blacklisted_at', 'blacklisted_by', 'blacklist_reason', 'blacklist_reference',
    ];

    protected $casts = [
        'is_approved'    => 'boolean',
        'is_active'      => 'boolean',
        'is_sme'         => 'boolean',
        'is_blacklisted' => 'boolean',
        'contacts'       => 'array',
        'geographic_coverage' => 'array',
        'incorporation_date' => 'date',
        'submitted_at'   => 'datetime',
        'approved_at'    => 'datetime',
        'rejected_at'    => 'datetime',
        'suspended_at'   => 'datetime',
        'blacklisted_at' => 'datetime',
        'finance_verified_at' => 'datetime',
        'critical_fields_locked_at' => 'datetime',
    ];

    protected $appends = ['derived_star_rating'];

    protected static function booted(): void
    {
        static::saving(function (Vendor $vendor): void {
            if ($vendor->status) {
                $vendor->status = self::normalizeStatus((string) $vendor->status);
            }
        });
    }

    public static function normalizeStatus(?string $status): string
    {
        $status = strtolower(trim((string) $status));
        if ($status === '') {
            return self::STATUS_DRAFT;
        }

        return self::LEGACY_STATUS_MAP[$status] ?? $status;
    }

    public function quotes()        { return $this->hasMany(ProcurementQuote::class); }
    public function approvedBy()    { return $this->belongsTo(User::class, 'approved_by'); }
    public function rejectedBy()    { return $this->belongsTo(User::class, 'rejected_by'); }
    public function blacklistedBy() { return $this->belongsTo(User::class, 'blacklisted_by'); }
    public function financeVerifiedBy() { return $this->belongsTo(User::class, 'finance_verified_by'); }
    public function ratings()       { return $this->hasMany(VendorRating::class); }
    public function evaluations()   { return $this->hasMany(VendorPerformanceEvaluation::class); }
    public function contracts()     { return $this->hasMany(Contract::class); }
    public function portalUsers()   { return $this->hasMany(User::class); }
    public function categories()    { return $this->belongsToMany(SupplierCategory::class, 'vendor_supplier_category')->withTimestamps(); }
    public function approvalLogs()  { return $this->hasMany(SupplierApprovalLog::class)->latest('performed_at'); }
    public function rfqInvitations(){ return $this->hasMany(RfqInvitation::class); }
    public function owners(): HasMany { return $this->hasMany(VendorOwner::class)->orderBy('sort_order')->orderBy('id'); }
    public function supplierDocuments(): HasMany { return $this->hasMany(SupplierDocument::class); }
    public function currentDocuments(): HasMany { return $this->hasMany(SupplierDocument::class)->where('is_current', true); }
    public function changeRequests(): HasMany { return $this->hasMany(SupplierChangeRequest::class)->latest(); }
    public function declarationAcceptances(): HasMany { return $this->hasMany(SupplierDeclarationAcceptance::class); }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function approvalRequest(): MorphOne
    {
        return $this->morphOne(ApprovalRequest::class, 'approvable');
    }

    public function onWorkflowApproved(User $approver): void
    {
        app(\App\Modules\Procurement\Services\VendorService::class)->approveVendor($this, $approver);
    }

    public function onWorkflowRejected(User $approver, ?string $reason = null): void
    {
        app(\App\Modules\Procurement\Services\VendorService::class)->rejectVendor($this, $reason ?? 'Rejected during approval workflow.', $approver);
    }

    public function procurementRequests()
    {
        return $this->hasManyThrough(
            ProcurementRequest::class,
            ProcurementQuote::class,
            'vendor_id',
            'id',
            'id',
            'procurement_request_id'
        );
    }

    /**
     * Mean overall_score from performance evaluations mapped to 1–5 stars.
     */
    public function getDerivedStarRatingAttribute(): ?int
    {
        $evaluations = $this->relationLoaded('evaluations')
            ? $this->evaluations
            : $this->evaluations()->get();

        if ($evaluations->isEmpty()) {
            return null;
        }

        $meanOverall = (float) $evaluations->avg(fn (VendorPerformanceEvaluation $e) => $e->overall_score);
        $percent = $meanOverall * 20;

        return self::starsFromOverallPercent($percent);
    }

    public static function starsFromOverallPercent(float $percent): ?int
    {
        if ($percent <= 0) {
            return null;
        }
        if ($percent >= 90) {
            return 5;
        }
        if ($percent >= 70) {
            return 4;
        }
        if ($percent >= 50) {
            return 3;
        }
        if ($percent >= 30) {
            return 2;
        }

        return 1;
    }

    public function criticalFieldsLocked(): bool
    {
        return $this->critical_fields_locked_at !== null
            || in_array($this->normalizedStatus(), [
                self::STATUS_APPROVED,
                self::STATUS_CONDITIONALLY_APPROVED,
                self::STATUS_COMPLIANCE_WARNING,
            ], true);
    }

    public function normalizedStatus(): string
    {
        return self::normalizeStatus($this->status);
    }

    public function isPendingReview(): bool
    {
        return in_array($this->normalizedStatus(), self::PENDING_REVIEW_STATUSES, true);
    }

    /**
     * Rejected, suspended, debarred, or archived vendors must not use the portal.
     * Expired stays reachable so suppliers can upload replacement documents.
     */
    public function portalAccessBlocked(): bool
    {
        return in_array($this->normalizedStatus(), [
            self::STATUS_REJECTED,
            self::STATUS_SUSPENDED,
            self::STATUS_DEBARRED,
            self::STATUS_ARCHIVED,
        ], true);
    }

    public function canSubmitApplication(): bool
    {
        return in_array($this->normalizedStatus(), [
            self::STATUS_DRAFT,
            self::STATUS_CORRECTION_REQUIRED,
        ], true);
    }

    public function syncLegacyFlagsFromStatus(): void
    {
        $status = $this->normalizedStatus();
        $approved = $status === self::STATUS_APPROVED;
        $active = in_array($status, self::PORTAL_LOGIN_STATUSES, true);
        $blacklisted = $status === self::STATUS_DEBARRED;

        $this->forceFill([
            'is_approved'    => $approved,
            'is_active'      => $active,
            'is_blacklisted' => $blacklisted,
        ]);
    }
}
