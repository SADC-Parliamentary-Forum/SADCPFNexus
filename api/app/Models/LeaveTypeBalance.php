<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Per-(user, leave_type, period_year) balance snapshot. Unlike the narrow
 * leave_balances table (annual + sick only), this holds every leave type
 * present in a source report so historical imports don't discard non-annual
 * balances (compassionate, compensatory, paternity, study, home, etc.).
 */
class LeaveTypeBalance extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'leave_type_id',
        'leave_type',
        'period_year',
        'entitlement',
        'balance_brought_forward',
        'accrued',
        'taken',
        'balance_carried_forward',
        'source',
        'imported_at',
    ];

    protected $casts = [
        'entitlement' => 'decimal:4',
        'balance_brought_forward' => 'decimal:4',
        'accrued' => 'decimal:4',
        'taken' => 'decimal:4',
        'balance_carried_forward' => 'decimal:4',
        'imported_at' => 'datetime',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function leaveType(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class);
    }
}
