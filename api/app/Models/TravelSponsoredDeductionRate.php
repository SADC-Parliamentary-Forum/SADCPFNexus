<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelSponsoredDeductionRate extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'code',
        'meal_deduction_percent', 'accommodation_deduction_percent',
        'meal_deduction_fixed', 'accommodation_deduction_fixed',
        'notes', 'is_active', 'effective_from', 'effective_to',
    ];

    protected $casts = [
        'meal_deduction_percent' => 'decimal:2',
        'accommodation_deduction_percent' => 'decimal:2',
        'meal_deduction_fixed' => 'decimal:2',
        'accommodation_deduction_fixed' => 'decimal:2',
        'is_active' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    /**
     * Resolve meal deduction amount from policy against a DSA rate's meal component.
     */
    public function mealDeductionFor(?float $mealComponent): float
    {
        if ($this->meal_deduction_fixed !== null) {
            return (float) $this->meal_deduction_fixed;
        }
        $base = (float) ($mealComponent ?? 0);

        return round($base * ((float) $this->meal_deduction_percent / 100), 2);
    }

    public function accommodationDeductionFor(?float $accommodationComponent): float
    {
        if ($this->accommodation_deduction_fixed !== null) {
            return (float) $this->accommodation_deduction_fixed;
        }
        $base = (float) ($accommodationComponent ?? 0);

        return round($base * ((float) $this->accommodation_deduction_percent / 100), 2);
    }
}
