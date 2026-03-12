<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Asset extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_code', 'name', 'category', 'status',
        'assigned_to', 'issued_at', 'value', 'notes',
        'invoice_number', 'invoice_path', 'purchase_date', 'purchase_value',
        'useful_life_years', 'salvage_value', 'depreciation_method', 'qr_path',
    ];

    protected $appends = ['age_years', 'age_display', 'current_value', 'qr_url'];

    /**
     * URL path to fetch QR code image (client should prepend API base).
     */
    public function getQrUrlAttribute(): ?string
    {
        return $this->qr_path ? '/api/v1/assets/' . $this->id . '/qr' : null;
    }

    protected function casts(): array
    {
        return [
            'issued_at' => 'date',
            'purchase_date' => 'date',
        ];
    }

    /**
     * Reference date for age: purchase_date if set, else issued_at.
     */
    public function getAgeReferenceDateAttribute(): ?Carbon
    {
        if ($this->purchase_date) {
            return $this->purchase_date;
        }
        if ($this->issued_at) {
            return $this->issued_at;
        }
        return null;
    }

    /**
     * Age in full years from reference date to today.
     */
    public function getAgeYearsAttribute(): ?int
    {
        $ref = $this->age_reference_date;
        if (! $ref) {
            return null;
        }
        return (int) $ref->diffInYears(now());
    }

    /**
     * Human-readable age (e.g. "2 years 3 months").
     */
    public function getAgeDisplayAttribute(): ?string
    {
        $ref = $this->age_reference_date;
        if (! $ref) {
            return null;
        }
        $years = $ref->diffInYears(now());
        $months = $ref->copy()->addYears($years)->diffInMonths(now());
        if ($years === 0) {
            return $months === 0 ? 'Less than 1 month' : "{$months} month(s)";
        }
        if ($months === 0) {
            return "{$years} year(s)";
        }
        return "{$years} year(s) {$months} month(s)";
    }

    /**
     * Compute straight-line depreciated value. Used when creating/updating and in accessor.
     *
     * @param  float|null  $purchaseValue
     * @param  int|null  $usefulLifeYears
     * @param  float  $salvageValue
     * @param  \Carbon\Carbon|null  $referenceDate
     */
    public static function computeDepreciatedValue(?float $purchaseValue, ?int $usefulLifeYears, float $salvageValue = 0, ?Carbon $referenceDate = null): ?float
    {
        if ($purchaseValue === null || $usefulLifeYears === null || $usefulLifeYears <= 0 || ! $referenceDate) {
            return null;
        }
        $yearsElapsed = min($referenceDate->diffInYears(now()), $usefulLifeYears);
        $depreciable = $purchaseValue - $salvageValue;
        $current = $salvageValue + $depreciable * max(0, 1 - $yearsElapsed / $usefulLifeYears);
        return round($current, 2);
    }

    /**
     * Current (depreciated) value. Straight-line from purchase_value, useful_life_years, salvage_value.
     * If insufficient data, returns the stored value column.
     */
    public function getCurrentValueAttribute(): ?float
    {
        $purchaseValue = $this->purchase_value !== null ? (float) $this->purchase_value : null;
        $usefulLife = $this->useful_life_years ? (int) $this->useful_life_years : null;
        $salvage = $this->salvage_value !== null ? (float) $this->salvage_value : 0.0;
        $ref = $this->age_reference_date;

        $computed = self::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $ref);
        if ($computed !== null) {
            return $computed;
        }
        return $this->value !== null ? (float) $this->value : null;
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }
}
