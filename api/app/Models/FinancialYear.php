<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class FinancialYear extends Model
{
    protected $fillable = [
        'tenant_id',
        'code',
        'label',
        'starts_on',
        'ends_on',
        'status',
    ];

    protected $casts = [
        'starts_on' => 'date',
        'ends_on' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function budgets(): HasMany
    {
        return $this->hasMany(Budget::class);
    }

    public static function defaultAprilMarch(int $tenantId, int $startYear): self
    {
        $endYear = $startYear + 1;
        $code = sprintf('%d/%02d', $startYear, $endYear % 100);

        return static::query()->firstOrCreate(
            ['tenant_id' => $tenantId, 'code' => $code],
            [
                'label' => "FY {$code}",
                'starts_on' => "{$startYear}-04-01",
                'ends_on' => "{$endYear}-03-31",
                'status' => 'open',
            ]
        );
    }
}
