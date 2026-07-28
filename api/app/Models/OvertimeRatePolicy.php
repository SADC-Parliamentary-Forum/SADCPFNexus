<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimeRatePolicy extends Model
{
    public const NORMAL_WORKING_DAY = 'normal_working_day';
    public const WEEKEND = 'weekend';
    public const PUBLIC_HOLIDAY = 'public_holiday';

    protected $fillable = [
        'tenant_id', 'day_type', 'multiplier', 'is_active',
        'policy_reference', 'effective_from', 'effective_to',
    ];

    protected $casts = [
        'multiplier' => 'decimal:2',
        'is_active' => 'boolean',
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }
}
