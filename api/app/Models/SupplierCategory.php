<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SupplierCategory extends Model
{
    protected $fillable = [
        'tenant_id',
        'name',
        'code',
        'description',
        'is_active',
    ];

    protected $casts = [
        'is_active' => 'boolean',
    ];

    public function vendors()
    {
        return $this->belongsToMany(Vendor::class, 'vendor_supplier_category')->withTimestamps();
    }

    public function procurementRequests()
    {
        return $this->belongsToMany(ProcurementRequest::class, 'procurement_request_supplier_category')->withTimestamps();
    }
}
