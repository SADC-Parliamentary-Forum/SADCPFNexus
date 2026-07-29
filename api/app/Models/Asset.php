<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Asset extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_code', 'serial_number', 'tag_number', 'name',
        'manufacturer', 'model', 'category', 'asset_class', 'status', 'condition',
        'purchase_order_id', 'procurement_request_id', 'goods_receipt_note_id',
        'assigned_to', 'issued_at', 'value', 'notes',
        'invoice_number', 'invoice_path', 'purchase_date', 'purchase_value',
        'useful_life_years', 'salvage_value', 'depreciation_method', 'qr_path',
        'funding_source', 'donor_name', 'donor_restrictions', 'department',
        'location_id', 'warranty_expiry', 'warranty_provider',
        'capitalisation_policy_id', 'accumulated_depreciation', 'book_value',
        'currency', 'last_verified_at', 'acknowledgement_at', 'acknowledged_by',
        'serial_duplicate_override',
    ];

    protected $appends = ['age_years', 'age_display', 'current_value', 'qr_url'];

    public function getQrUrlAttribute(): ?string
    {
        return $this->qr_path ? '/api/v1/assets/' . $this->id . '/qr' : null;
    }

    protected function casts(): array
    {
        return [
            'issued_at' => 'date',
            'purchase_date' => 'date',
            'warranty_expiry' => 'date',
            'last_verified_at' => 'datetime',
            'acknowledgement_at' => 'datetime',
            'serial_duplicate_override' => 'boolean',
            'purchase_value' => 'decimal:2',
            'value' => 'decimal:2',
            'salvage_value' => 'decimal:2',
            'accumulated_depreciation' => 'decimal:2',
            'book_value' => 'decimal:2',
        ];
    }

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

    public function getAgeYearsAttribute(): ?int
    {
        $ref = $this->age_reference_date;
        if (! $ref) {
            return null;
        }

        return (int) $ref->diffInYears(now());
    }

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

    public static function computeDepreciatedValue(
        ?float $purchaseValue,
        ?int $usefulLifeYears,
        float $salvageValue = 0,
        ?Carbon $referenceDate = null,
        string $method = 'straight_line',
    ): ?float {
        if ($purchaseValue === null || $usefulLifeYears === null || $usefulLifeYears <= 0 || ! $referenceDate) {
            return null;
        }

        $yearsElapsed = min(
            max(0.0, $referenceDate->diffInDays(now(), false) / 365.25),
            (float) $usefulLifeYears,
        );

        if ($method === 'declining_balance') {
            $rate = 2 / $usefulLifeYears;
            $current = $purchaseValue * pow(1 - $rate, $yearsElapsed);

            return round(max($salvageValue, $current), 2);
        }

        $depreciable = $purchaseValue - $salvageValue;
        $current = $salvageValue + $depreciable * max(0, 1 - $yearsElapsed / $usefulLifeYears);

        return round($current, 2);
    }

    public function getCurrentValueAttribute(): ?float
    {
        if ($this->book_value !== null) {
            return (float) $this->book_value;
        }
        $purchaseValue = $this->purchase_value !== null ? (float) $this->purchase_value : null;
        $usefulLife = $this->useful_life_years ? (int) $this->useful_life_years : null;
        $salvage = $this->salvage_value !== null ? (float) $this->salvage_value : 0.0;
        $ref = $this->age_reference_date;
        $method = $this->depreciation_method ?: 'straight_line';

        $computed = self::computeDepreciatedValue($purchaseValue, $usefulLife, $salvage, $ref, $method);
        if ($computed !== null) {
            return $computed;
        }

        return $this->value !== null ? (float) $this->value : null;
    }

    public function isDisposed(): bool
    {
        return in_array($this->status, ['disposed', 'sold', 'written_off', 'scrapped', 'donated_out'], true);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function assignedUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'assigned_to');
    }

    public function location(): BelongsTo
    {
        return $this->belongsTo(AssetLocation::class, 'location_id');
    }

    public function capitalisationPolicy(): BelongsTo
    {
        return $this->belongsTo(AssetCapitalisationPolicy::class, 'capitalisation_policy_id');
    }

    public function assignmentHistories(): HasMany
    {
        return $this->hasMany(AssetAssignmentHistory::class);
    }

    public function locationHistories(): HasMany
    {
        return $this->hasMany(AssetLocationHistory::class);
    }

    public function disposals(): HasMany
    {
        return $this->hasMany(AssetDisposal::class);
    }

    public function maintenanceRecords(): HasMany
    {
        return $this->hasMany(AssetMaintenanceRecord::class);
    }
}
