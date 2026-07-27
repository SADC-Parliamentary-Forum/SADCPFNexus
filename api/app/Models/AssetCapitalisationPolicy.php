<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetCapitalisationPolicy extends Model
{
    protected $fillable = [
        'tenant_id', 'version', 'effective_from', 'effective_to',
        'threshold_amount', 'threshold_currency', 'min_useful_life_years',
        'categories_affected', 'donor_specific_treatment', 'approved_by',
        'source_document', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'effective_from' => 'date',
            'effective_to' => 'date',
            'threshold_amount' => 'decimal:2',
            'categories_affected' => 'array',
            'is_active' => 'boolean',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
