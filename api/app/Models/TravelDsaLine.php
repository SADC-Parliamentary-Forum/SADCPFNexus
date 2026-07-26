<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TravelDsaLine extends Model
{
    protected $fillable = [
        'travel_request_id', 'date', 'destination', 'rate_type', 'daily_rate',
        'meal_deduction', 'adjustments', 'daily_payable', 'is_personal', 'notes',
    ];

    protected $casts = [
        'date'           => 'date',
        'daily_rate'     => 'decimal:2',
        'meal_deduction' => 'decimal:2',
        'adjustments'    => 'decimal:2',
        'daily_payable'  => 'decimal:2',
        'is_personal'    => 'boolean',
        'rate_type'      => 'integer',
    ];

    public function travelRequest(): BelongsTo
    {
        return $this->belongsTo(TravelRequest::class);
    }
}
