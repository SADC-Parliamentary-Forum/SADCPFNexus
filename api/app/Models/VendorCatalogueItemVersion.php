<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class VendorCatalogueItemVersion extends Model
{
    protected $fillable = [
        'vendor_catalogue_item_id', 'version', 'unit_price', 'currency', 'unit',
        'change_reason', 'changed_by', 'changed_at',
    ];

    protected $casts = [
        'unit_price' => 'float',
        'version'    => 'integer',
        'changed_at' => 'datetime',
    ];

    public function item()
    {
        return $this->belongsTo(VendorCatalogueItem::class, 'vendor_catalogue_item_id');
    }

    public function changedBy()
    {
        return $this->belongsTo(User::class, 'changed_by');
    }
}
