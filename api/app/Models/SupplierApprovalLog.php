<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierApprovalLog extends Model
{
    protected $fillable = [
        'tenant_id',
        'vendor_id',
        'action',
        'reason',
        'metadata',
        'performed_by',
        'performed_at',
    ];

    protected $casts = [
        'metadata'     => 'array',
        'performed_at' => 'datetime',
    ];

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function performer()
    {
        return $this->belongsTo(User::class, 'performed_by');
    }
}
