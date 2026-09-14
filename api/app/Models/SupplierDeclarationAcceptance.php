<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SupplierDeclarationAcceptance extends Model
{
    protected $fillable = [
        'tenant_id',
        'vendor_id',
        'template_id',
        'accepted_by',
        'accepted_at',
        'ip_address',
    ];

    protected $casts = [
        'accepted_at' => 'datetime',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function template(): BelongsTo
    {
        return $this->belongsTo(SupplierDeclarationTemplate::class, 'template_id');
    }

    public function acceptedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'accepted_by');
    }
}
