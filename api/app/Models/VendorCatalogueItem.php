<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class VendorCatalogueItem extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'tenant_id', 'vendor_id', 'sku', 'item_name', 'unit', 'unit_price',
        'currency', 'effective_from', 'effective_to', 'is_active', 'notes', 'updated_by',
    ];

    protected $casts = [
        'unit_price'     => 'float',
        'effective_from' => 'date',
        'effective_to'   => 'date',
        'is_active'      => 'boolean',
    ];

    public function vendor()
    {
        return $this->belongsTo(Vendor::class);
    }

    public function versions()
    {
        return $this->hasMany(VendorCatalogueItemVersion::class)->orderBy('version');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
