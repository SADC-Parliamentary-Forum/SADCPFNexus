<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetCycleApproval extends Model
{
    protected $fillable = [
        'budget_cycle_id',
        'stage',
        'decision',
        'decided_by',
        'decided_at',
        'comments',
        'approved_total',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
        'approved_total' => 'float',
    ];

    public function cycle(): BelongsTo
    {
        return $this->belongsTo(BudgetCycle::class, 'budget_cycle_id');
    }

    public function decidedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
