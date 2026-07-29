<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Consumable stock item. SEPARATE from Asset.
 * Available = on_hand − reserved − quarantined.
 */
class StockItem extends Model
{
    protected $fillable = [
        'tenant_id',
        'stock_category_id',
        'item_code',
        'barcode',
        'name',
        'description',
        'unit',
        'stock_unit_id',
        'unit_cost',
        'current_balance',
        'quantity_reserved',
        'quantity_quarantined',
        'reorder_level',
        'max_level',
        'tracks_batches',
        'storage_location',
        'stock_location_id',
        'vendor_id',
        'procurement_request_id',
        'purchase_order_id',
        'status',
        'notes',
    ];

    protected $appends = ['is_low_stock', 'stock_value', 'available_quantity'];

    protected function casts(): array
    {
        return [
            'unit_cost'             => 'decimal:2',
            'current_balance'       => 'integer',
            'quantity_reserved'     => 'integer',
            'quantity_quarantined'  => 'integer',
            'reorder_level'         => 'integer',
            'max_level'             => 'integer',
            'tracks_batches'        => 'boolean',
        ];
    }

    public function getAvailableQuantityAttribute(): int
    {
        return max(
            0,
            (int) $this->current_balance - (int) $this->quantity_reserved - (int) $this->quantity_quarantined
        );
    }

    public function getIsLowStockAttribute(): bool
    {
        return $this->reorder_level > 0 && $this->available_quantity <= $this->reorder_level;
    }

    public function getStockValueAttribute(): ?float
    {
        if ($this->unit_cost === null) {
            return null;
        }

        return round((float) $this->unit_cost * (int) $this->current_balance, 2);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(StockCategory::class, 'stock_category_id');
    }

    public function unitOfMeasure(): BelongsTo
    {
        return $this->belongsTo(StockUnit::class, 'stock_unit_id');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(StockLocation::class, 'stock_location_id');
    }

    public function vendor(): BelongsTo
    {
        return $this->belongsTo(Vendor::class);
    }

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function purchaseOrder(): BelongsTo
    {
        return $this->belongsTo(PurchaseOrder::class);
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(StockTransaction::class);
    }

    public function batches(): HasMany
    {
        return $this->hasMany(StockBatch::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(StockReservation::class);
    }

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    public function scopeLowStock(Builder $query): Builder
    {
        return $query->where('reorder_level', '>', 0)
            ->whereRaw('(current_balance - quantity_reserved - quantity_quarantined) <= reorder_level');
    }

    public function scopeForTenant(Builder $query, $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }
}
