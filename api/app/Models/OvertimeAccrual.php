<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimeAccrual extends Model
{
    protected $fillable = [
        'user_id',
        'code',
        'description',
        'hours',
        'accrual_date',
        'approved_by_name',
        'is_verified',
        'is_linked',
    ];

    protected function casts(): array
    {
        return [
            'hours'       => 'decimal:1',
            'accrual_date'=> 'date',
            'is_verified' => 'boolean',
            'is_linked'   => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
