<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BudgetCommitmentTransaction extends Model
{
    protected $fillable = [
        'budget_reservation_id',
        'type',
        'amount',
        'balance_after',
        'actor_id',
        'reason',
        'meta',
    ];

    protected $casts = [
        'amount' => 'float',
        'balance_after' => 'float',
        'meta' => 'array',
    ];

    public function commitment(): BelongsTo
    {
        return $this->belongsTo(BudgetReservation::class, 'budget_reservation_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
