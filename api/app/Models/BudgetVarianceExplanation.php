<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetVarianceExplanation extends Model
{
    public const CATEGORIES = [
        'timing',
        'underspend',
        'overspend',
        'activity_delayed',
        'activity_cancelled',
        'price_increase',
        'exchange_rate',
        'procurement_saving',
        'participant_variation',
        'donor_change',
        'scope_change',
        'unplanned_expenditure',
        'other',
    ];

    protected $fillable = [
        'budget_variance_id',
        'submitted_by',
        'category',
        'explanation',
        'remedial_action',
        'status',
        'reviewed_by',
        'reviewed_at',
        'finance_comments',
    ];

    protected $casts = [
        'reviewed_at' => 'datetime',
    ];

    public function variance(): BelongsTo
    {
        return $this->belongsTo(BudgetVariance::class, 'budget_variance_id');
    }

    public function submitter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'submitted_by');
    }

    public function reviewer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }
}
