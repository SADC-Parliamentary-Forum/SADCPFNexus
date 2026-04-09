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
        'is_approved', 'is_active', 'is_sme', 'notes',
        'rejection_reason', 'approved_at', 'approved_by',
        'is_blacklisted', 'blacklisted_at', 'blacklisted_by', 'blacklist_reason', 'blacklist_reference',
    ];

    protected $casts = [
        'is_approved'    => 'boolean',
        'is_active'      => 'boolean',
        'is_sme'         => 'boolean',
        'is_blacklisted' => 'boolean',
        'approved_at'    => 'datetime',
        'blacklisted_at' => 'datetime',
    ];

    public function quotes()        { return $this->hasMany(ProcurementQuote::class); }
    public function approvedBy()    { return $this->belongsTo(User::class, 'approved_by'); }
    public function blacklistedBy() { return $this->belongsTo(User::class, 'blacklisted_by'); }
    public function ratings()       { return $this->hasMany(VendorRating::class); }
    public function evaluations()   { return $this->hasMany(VendorPerformanceEvaluation::class); }
    public function contracts()     { return $this->hasMany(Contract::class); }

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
}
