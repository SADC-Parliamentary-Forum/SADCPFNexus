<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RfqInvitation extends Model
{
    protected $fillable = [
        'tenant_id',
        'procurement_request_id',
        'vendor_id',
        'invitation_type',
        'status',
        'invited_name',
        'invited_email',
        'response_token',
        'response_expires_at',
        'invited_at',
        'viewed_at',
        'responded_at',
        'last_notified_at',
        'notes',
        'created_by',
    ];

    protected $casts = [
        'response_expires_at' => 'datetime',
        'invited_at'          => 'datetime',
        'viewed_at'           => 'datetime',
        'responded_at'        => 'datetime',
        'last_notified_at'    => 'datetime',
    ];

    public function procurementRequest()
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function quote()
    {
        return $this->hasOne(ProcurementQuote::class);
    }
}
