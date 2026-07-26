<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class BudgetReservation extends Model
{
    use SoftDeletes;

    public const ACTIVE_STATUSES = [
        'proposed',
        'reserved',
        'confirmed',
        'partially_utilised',
    ];

    protected $fillable = [
        'tenant_id',
        'commitment_chain_id',
        'parent_commitment_id',
        'procurement_request_id',
        'travel_request_id',
        'programme_id',
        'reserved_by',
        'budget_line',
        'budget_line_id',
        'source_type',
        'source_id',
        'source_key',
        'idempotency_key',
        'reserved_amount',
        'original_amount',
        'current_amount',
        'currency',
        'notes',
        'status',
        'reserved_at',
        'confirmed_at',
        'released_at',
        'released_by',
        'consumed_at',
    ];

    protected $casts = [
        'reserved_amount' => 'float',
        'original_amount' => 'float',
        'current_amount' => 'float',
        'released_at' => 'datetime',
        'reserved_at' => 'datetime',
        'confirmed_at' => 'datetime',
        'consumed_at' => 'datetime',
    ];

    public function procurementRequest(): BelongsTo
    {
        return $this->belongsTo(ProcurementRequest::class);
    }

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class);
    }

    public function budgetLine(): BelongsTo
    {
        return $this->belongsTo(BudgetLine::class, 'budget_line_id');
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_commitment_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_commitment_id');
    }

    public function transactions(): HasMany
    {
        return $this->hasMany(BudgetCommitmentTransaction::class, 'budget_reservation_id');
    }

    public function reservedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reserved_by');
    }

    public function releasedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'released_by');
    }

    public function isReleased(): bool
    {
        return $this->released_at !== null || $this->status === 'released';
    }

    public function isActive(): bool
    {
        return ! $this->isReleased()
            && in_array($this->status, self::ACTIVE_STATUSES, true)
            && (float) $this->current_amount > 0;
    }
}
