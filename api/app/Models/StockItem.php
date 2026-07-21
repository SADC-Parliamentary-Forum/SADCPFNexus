<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Consumable stock item (PRD §17.2). Tracks running balance, reorder level,
 * storage location and optional procurement linkage. SEPARATE from Asset.
 */
class StockItem extends Model
{
    protected $fillable = [
        'tenant_id',
        'stock_category_id',
        'item_code',
        'name',
        'description',
        'unit',
        'unit_cost',
        'current_balance',
        'reorder_level',
        'storage_location',
        'vendor_id',
        'procurement_request_id',
        'purchase_order_id',
        'status',
        'notes',
    ];

    protected $appends = ['is_low_stock', 'stock_value'];

    protected function casts(): array
    {
        return [
            'unit_cost'       => 'decimal:2',
            'current_balance' => 'integer',
            'reorder_level'   => 'integer',
        ];
    }

    /**
     * True when the running balance is at or below the configured reorder level.
     * A reorder level of 0 disables the flag (no threshold configured).
     */
    public function getIsLowStockAttribute(): bool
    {
        return $this->reorder_level > 0 && $this->current_balance <= $this->reorder_level;
    }

    /**
     * Indicative value of stock on hand (balance × unit cost).
     */
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

    public function attachments(): MorphMany
    {
        return $this->morphMany(Attachment::class, 'attachable')->latest();
    }

    /**
     * Scope to items at or below their reorder level (reorder level configured).
     */
    public function scopeLowStock(Builder $query): Builder
    {
        return $query->where('reorder_level', '>', 0)
            ->whereColumn('current_balance', '<=', 'reorder_level');
    }

    public function scopeForTenant(Builder $query, $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }
}
