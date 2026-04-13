<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\MorphMany;

class Vendor extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'contact_name', 'registration_number', 'tax_number',
        'contact_email', 'contact_phone', 'website', 'address', 'country', 'category',
        'payment_terms', 'bank_name', 'bank_account', 'bank_branch',
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
        'submitted_at'   => 'datetime',
        'approved_at'    => 'datetime',
        'rejected_at'    => 'datetime',
        'suspended_at'   => 'datetime',
        'blacklisted_at' => 'datetime',
    ];

    public function quotes()        { return $this->hasMany(ProcurementQuote::class); }
    public function approvedBy()    { return $this->belongsTo(User::class, 'approved_by'); }
    public function rejectedBy()    { return $this->belongsTo(User::class, 'rejected_by'); }
    public function blacklistedBy() { return $this->belongsTo(User::class, 'blacklisted_by'); }
    public function ratings()       { return $this->hasMany(VendorRating::class); }
    public function evaluations()   { return $this->hasMany(VendorPerformanceEvaluation::class); }
    public function contracts()     { return $this->hasMany(Contract::class); }
    public function portalUsers()   { return $this->hasMany(User::class); }
    public function categories()    { return $this->belongsToMany(SupplierCategory::class, 'vendor_supplier_category')->withTimestamps(); }
    public function approvalLogs()  { return $this->hasMany(SupplierApprovalLog::class)->latest('performed_at'); }
    public function rfqInvitations(){ return $this->hasMany(RfqInvitation::class); }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
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

    public function syncLegacyFlagsFromStatus(): void
    {
        $approved = $this->status === 'approved';
        $active = in_array($this->status, ['pending_approval', 'approved'], true);
        $blacklisted = $this->status === 'blacklisted';

        $this->forceFill([
            'is_approved'    => $approved,
            'is_active'      => $active,
            'is_blacklisted' => $blacklisted,
        ]);
    }
}
