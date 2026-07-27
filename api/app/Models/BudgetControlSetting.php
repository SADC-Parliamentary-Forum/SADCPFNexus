<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetControlSetting extends Model
{
    protected $fillable = [
        'tenant_id',
        'significant_variance_pct',
        'warning_utilisation_pct',
        'critical_utilisation_pct',
    ];

    protected $casts = [
        'significant_variance_pct' => 'float',
        'warning_utilisation_pct' => 'integer',
        'critical_utilisation_pct' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public static function forTenant(int $tenantId): self
    {
        return static::query()->firstOrCreate(
            ['tenant_id' => $tenantId],
            [
                'significant_variance_pct' => 20,
                'warning_utilisation_pct' => 80,
                'critical_utilisation_pct' => 100,
            ]
        );
    }
}
