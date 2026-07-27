<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class CashflowScenarioAdjustment extends Model
{
    public const DIRECTIONS = ['inflow', 'outflow'];

    protected $fillable = [
        'cashflow_scenario_id',
        'period',
        'direction',
        'amount',
        'label',
        'category',
        'budget_reservation_id',
        'meta',
    ];

    protected $casts = [
        'amount' => 'float',
        'meta' => 'array',
    ];

    public function scenario(): BelongsTo
    {
        return $this->belongsTo(CashflowScenario::class, 'cashflow_scenario_id');
    }

    public function reservation(): BelongsTo
    {
        return $this->belongsTo(BudgetReservation::class, 'budget_reservation_id');
    }
}
