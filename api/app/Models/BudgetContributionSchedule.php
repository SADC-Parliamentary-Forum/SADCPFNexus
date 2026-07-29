<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetContributionSchedule extends Model
{
    protected $fillable = [
        'tenant_id',
        'donor_name',
        'source_type',
        'currency',
        'amount',
        'frequency',
        'start_date',
        'end_date',
        'next_due_date',
        'status',
        'notes',
        'created_by',
    ];

    protected function casts(): array
    {
        return [
            'amount' => 'float',
            'start_date' => 'date',
            'end_date' => 'date',
            'next_due_date' => 'date',
        ];
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
