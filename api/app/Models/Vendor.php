<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Vendor extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'registration_number', 'contact_email', 'contact_phone',
        'address', 'is_approved', 'is_active', 'rejection_reason', 'approved_at', 'approved_by',
    ];

    protected $casts = [
        'is_approved'  => 'boolean',
        'is_active'    => 'boolean',
        'approved_at'  => 'datetime',
    ];

    public function quotes()     { return $this->hasMany(ProcurementQuote::class); }
    public function approvedBy() { return $this->belongsTo(User::class, 'approved_by'); }

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
