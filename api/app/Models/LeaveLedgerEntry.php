<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveLedgerEntry extends Model
{
    public const OPENING_BALANCE = 'opening_balance';
    public const ACCRUAL = 'accrual';
    public const LEAVE_TAKEN = 'leave_taken';
    public const LEAVE_REVERSAL = 'leave_reversal';
    public const TOIL_CREDIT = 'toil_credit';
    public const TOIL_USAGE = 'toil_usage';
    public const TOIL_EXPIRY = 'toil_expiry';
    public const ADJUSTMENT = 'adjustment';
    public const RESERVATION = 'reservation';
    public const RESERVATION_RELEASE = 'reservation_release';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'leave_type_id',
        'policy_version_id',
        'leave_type',
        'transaction_type',
        'amount',
        'unit',
        'effective_date',
        'source_type',
        'source_id',
        'reference',
        'balance_after',
        'recorded_by',
        'approved_by',
        'reason',
    ];

    protected $casts = [
        'amount' => 'decimal:2',
        'effective_date' => 'date',
        'balance_after' => 'decimal:2',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
