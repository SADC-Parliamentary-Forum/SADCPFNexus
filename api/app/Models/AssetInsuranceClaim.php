<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetInsuranceClaim extends Model
{
    public const STATUSES = ['draft', 'filed', 'under_review', 'settled', 'rejected', 'withdrawn'];

    protected $fillable = [
        'tenant_id',
        'policy_id',
        'asset_id',
        'claim_number',
        'incident_date',
        'filed_at',
        'claim_amount',
        'settled_amount',
        'currency',
        'status',
        'description',
        'outcome_notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'incident_date' => 'date',
            'filed_at' => 'date',
            'claim_amount' => 'decimal:2',
            'settled_amount' => 'decimal:2',
        ];
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(AssetInsurancePolicy::class, 'policy_id');
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
