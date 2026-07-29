<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AssetInsurancePolicy extends Model
{
    public const STATUSES = ['active', 'expired', 'cancelled'];

    protected $fillable = [
        'tenant_id',
        'policy_number',
        'insurer_name',
        'coverage_type',
        'effective_from',
        'effective_to',
        'sum_insured',
        'premium_amount',
        'currency',
        'status',
        'asset_id',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'sum_insured' => 'decimal:2',
            'premium_amount' => 'decimal:2',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function claims(): HasMany
    {
        return $this->hasMany(AssetInsuranceClaim::class, 'policy_id');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
