<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class VendorOwner extends Model
{
    protected $fillable = [
        'tenant_id',
        'vendor_id',
        'full_name',
        'role',
        'ownership_percent',
        'nationality',
        'id_number',
        'is_beneficial_owner',
        'is_pep',
        'sort_order',
    ];

    protected $casts = [
        'ownership_percent' => 'decimal:2',
        'is_beneficial_owner' => 'boolean',
        'is_pep' => 'boolean',
    ];

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }
}
