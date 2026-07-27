<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetChangeItem extends Model
{
    protected $fillable = [
        'budget_change_request_id',
        'source_budget_line_id',
        'target_budget_line_id',
        'new_line_code',
        'new_line_name',
        'new_line_category',
        'new_line_funding_source_id',
        'amount',
        'is_decrease',
        'notes',
        'sort_order',
    ];

    protected $casts = [
        'amount' => 'float',
        'is_decrease' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(BudgetChangeRequest::class, 'budget_change_request_id');
    }

    public function sourceLine(): BelongsTo
    {
        return $this->belongsTo(BudgetLine::class, 'source_budget_line_id');
    }

    public function targetLine(): BelongsTo
    {
        return $this->belongsTo(BudgetLine::class, 'target_budget_line_id');
    }

    public function signedAmount(): float
    {
        $amount = abs((float) $this->amount);

        return $this->is_decrease ? -$amount : $amount;
    }
}
