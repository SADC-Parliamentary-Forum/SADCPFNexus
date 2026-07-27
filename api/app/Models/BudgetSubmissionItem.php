<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetSubmissionItem extends Model
{
    protected $fillable = [
        'budget_submission_id',
        'funding_source_id',
        'category',
        'code',
        'name',
        'description',
        'quantity',
        'unit_rate',
        'calculated_amount',
        'requested_amount',
        'prior_year_amount',
        'justification',
        'workplan_ref',
        'sort_order',
    ];

    protected $casts = [
        'quantity' => 'float',
        'unit_rate' => 'float',
        'calculated_amount' => 'float',
        'requested_amount' => 'float',
        'prior_year_amount' => 'float',
        'sort_order' => 'integer',
    ];

    public function submission(): BelongsTo
    {
        return $this->belongsTo(BudgetSubmission::class, 'budget_submission_id');
    }

    public function fundingSource(): BelongsTo
    {
        return $this->belongsTo(FundingSource::class);
    }
}
