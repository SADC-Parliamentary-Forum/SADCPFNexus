<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class BudgetLine extends Model
{
    use HasFactory;

    protected $fillable = [
        'budget_id',
        'parent_line_id',
        'code',
        'name',
        'funding_source_id',
        'programme_id',
        'department_id',
        'category',
        'account_code',
        'gl_account_code',
        'description',
        'amount_allocated',
        'original_allocation',
        'revised_allocation',
        'amount_spent',
        'is_active',
        'is_contingency',
    ];

    protected $casts = [
        'amount_allocated' => 'float',
        'original_allocation' => 'float',
        'revised_allocation' => 'float',
        'amount_spent' => 'float',
        'is_active' => 'boolean',
        'is_contingency' => 'boolean',
    ];

    public function budget(): BelongsTo
    {
        return $this->belongsTo(Budget::class);
    }

    public function fundingSource(): BelongsTo
    {
        return $this->belongsTo(FundingSource::class);
    }

    public function programme(): BelongsTo
    {
        return $this->belongsTo(Programme::class);
    }

    public function department(): BelongsTo
    {
        return $this->belongsTo(Department::class);
    }

    public function commitments(): HasMany
    {
        return $this->hasMany(BudgetReservation::class, 'budget_line_id');
    }

    public function actuals(): HasMany
    {
        return $this->hasMany(BudgetActualTransaction::class);
    }

    public function currentApprovedAllocation(): float
    {
        if ($this->revised_allocation !== null) {
            return (float) $this->revised_allocation;
        }
        if ($this->original_allocation !== null) {
            return (float) $this->original_allocation;
        }

        return (float) $this->amount_allocated;
    }

    public function displayName(): string
    {
        return $this->name
            ?: $this->code
            ?: $this->category
            ?: ('Line #'.$this->id);
    }
}
