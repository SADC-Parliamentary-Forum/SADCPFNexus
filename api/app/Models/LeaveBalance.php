<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveBalance extends Model
{
    protected $fillable = [
        'user_id',
        'period_year',
        'annual_balance_days',
        'lil_hours_available',
        'sick_leave_used_days',
    ];

    protected function casts(): array
    {
        return [
            'lil_hours_available' => 'decimal:1',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
