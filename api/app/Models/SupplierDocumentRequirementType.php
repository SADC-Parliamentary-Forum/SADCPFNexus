<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SupplierDocumentRequirementType extends Model
{
    protected $fillable = [
        'tenant_id',
        'code',
        'label',
        'description',
        'mandatory',
        'country',
        'supplier_category_id',
        'has_expiry',
        'warning_days',
        'required_at_registration',
        'required_for_rfq',
        'funding_source',
        'requires_verification',
        'is_active',
        'sort_order',
    ];

    protected $casts = [
        'mandatory' => 'boolean',
        'has_expiry' => 'boolean',
        'required_at_registration' => 'boolean',
        'required_for_rfq' => 'boolean',
        'requires_verification' => 'boolean',
        'is_active' => 'boolean',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(SupplierCategory::class, 'supplier_category_id');
    }

    public function documents(): HasMany
    {
        return $this->hasMany(SupplierDocument::class, 'requirement_type_id');
    }

    public function appliesToVendor(Vendor $vendor): bool
    {
        if (! $this->is_active) {
            return false;
        }

        if ($this->country && strcasecmp((string) $vendor->country, $this->country) !== 0) {
            return false;
        }

        if ($this->supplier_category_id) {
            $categoryIds = $vendor->categories()->pluck('supplier_categories.id')->all();
            $expanded = SupplierCategory::expandWithAncestors((int) $vendor->tenant_id, $categoryIds);
            if (! in_array((int) $this->supplier_category_id, $expanded, true)) {
                return false;
            }
        }

        return true;
    }
}
