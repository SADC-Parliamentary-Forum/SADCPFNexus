<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DsaRate extends Model
{
    protected $fillable = [
        'tenant_id', 'country', 'city', 'rate_type', 'rate_per_day', 'currency',
        'accommodation_component', 'meal_component', 'incidentals_component',
        'effective_from', 'effective_to', 'version', 'is_active',
    ];

    protected $casts = [
        'rate_per_day'              => 'decimal:2',
        'accommodation_component'   => 'decimal:2',
        'meal_component'            => 'decimal:2',
        'incidentals_component'     => 'decimal:2',
        'effective_from'            => 'date',
        'effective_to'              => 'date',
        'is_active'                 => 'boolean',
        'rate_type'                 => 'integer',
        'version'                   => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function dailyTotal(): float
    {
        $components = (float) ($this->accommodation_component ?? 0)
            + (float) ($this->meal_component ?? 0)
            + (float) ($this->incidentals_component ?? 0);

        return $components > 0 ? $components : (float) $this->rate_per_day;
    }
}
