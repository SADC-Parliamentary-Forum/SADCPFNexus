<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetAcquisitionBatch extends Model
{
    protected $fillable = [
        'tenant_id', 'reference', 'description', 'qty', 'unit_cost', 'currency',
        'supplier_id', 'supplier_name', 'purchase_order_id', 'goods_receipt_note_id',
        'invoice_number', 'funding_source_id', 'funding_source', 'received_date',
        'category', 'subcategory_code', 'home_location_id', 'status', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost' => 'decimal:2',
            'received_date' => 'date',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function items(): HasMany
    {
        return $this->hasMany(AssetAcquisitionBatchItem::class, 'batch_id');
    }

    public function assets(): HasMany
    {
        return $this->hasMany(Asset::class, 'acquisition_batch_id');
    }

    public function homeLocation(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class, 'home_location_id');
    }

    public function createdBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
