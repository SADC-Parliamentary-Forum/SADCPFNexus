<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ToilCredit extends Model
{
    public const AVAILABLE = 'available';
    public const PARTIALLY_USED = 'partially_used';
    public const USED = 'used';
    public const EXPIRED = 'expired';
    public const EXTENDED = 'extended';
    public const CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'credit_reference',
        'source_type',
        'source_id',
        'duty_date',
        'earned_amount',
        'unit',
        'credited_days',
        'accrual_date',
        'expiry_date',
        'original_balance',
        'used_balance',
        'remaining_balance',
        'status',
        'validated_by',
        'validated_at',
    ];

    protected $casts = [
        'duty_date' => 'date',
        'earned_amount' => 'decimal:2',
        'credited_days' => 'decimal:2',
        'accrual_date' => 'date',
        'expiry_date' => 'date',
        'original_balance' => 'decimal:2',
        'used_balance' => 'decimal:2',
        'remaining_balance' => 'decimal:2',
        'validated_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function extensions(): HasMany
    {
        return $this->hasMany(ToilExtension::class, 'toil_credit_id');
    }
}
