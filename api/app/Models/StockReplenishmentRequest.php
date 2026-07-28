<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class StockReplenishmentRequest extends Model
{
    public const STATUS_OPEN = 'open';
    public const STATUS_LINKED = 'linked';
    public const STATUS_CLOSED = 'closed';
    public const STATUS_CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id',
        'reference_number',
        'stock_item_id',
        'quantity_suggested',
        'quantity_requested',
        'status',
        'requested_by',
        'procurement_request_id',
        'notes',
    ];

    protected function casts(): array
    {
        return [
            'quantity_suggested' => 'integer',
            'quantity_requested' => 'integer',
        ];
    }

    public function item(): BelongsTo
    {
        return $this->belongsTo(StockItem::class, 'stock_item_id');
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function scopeForTenant(Builder $query, $tenantId): Builder
    {
        return $query->where('tenant_id', $tenantId);
    }
}
