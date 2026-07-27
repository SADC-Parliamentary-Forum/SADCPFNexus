<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BudgetVariance extends Model
{
    protected $fillable = [
        'tenant_id',
        'budget_line_id',
        'financial_year_id',
        'period_type',
        'period_key',
        'as_of_date',
        'approved_budget',
        'actual_expenditure',
        'open_commitments',
        'available_budget',
        'variance_amount',
        'variance_pct',
        'utilisation_pct',
        'is_significant',
        'status',
    ];

    protected $casts = [
        'as_of_date' => 'date',
        'approved_budget' => 'float',
        'actual_expenditure' => 'float',
        'open_commitments' => 'float',
        'available_budget' => 'float',
        'variance_amount' => 'float',
        'variance_pct' => 'float',
        'utilisation_pct' => 'float',
        'is_significant' => 'boolean',
    ];

    public function budgetLine(): BelongsTo
    {
        return $this->belongsTo(BudgetLine::class);
    }

    public function financialYear(): BelongsTo
    {
        return $this->belongsTo(FinancialYear::class);
    }

    public function explanations(): HasMany
    {
        return $this->hasMany(BudgetVarianceExplanation::class);
    }
}
