<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetGuideline extends Model
{
    protected $fillable = [
        'budget_cycle_id',
        'submission_opens_on',
        'department_deadline',
        'assumptions',
        'inflation_rate',
        'fx_assumptions',
        'ceilings',
        'guidance_document_path',
        'published_by',
        'published_at',
    ];

    protected $casts = [
        'submission_opens_on' => 'date',
        'department_deadline' => 'date',
        'inflation_rate' => 'float',
        'ceilings' => 'array',
        'published_at' => 'datetime',
    ];

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(BudgetCycle::class, 'budget_cycle_id');
    }

    public function publishedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'published_by');
    }
}
