<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class OvertimeSettlement extends Model
{
    public const TYPE_PAY = 'pay';
    public const TYPE_TOIL = 'toil';

    public const PENDING = 'pending';
    public const SENT = 'sent';
    public const RECONCILED = 'reconciled';
    public const CANCELLED = 'cancelled';

    protected $fillable = [
        'tenant_id', 'overtime_actual_id', 'user_id', 'settlement_type',
        'hours', 'multiplier', 'payable_hours', 'status',
        'overtime_accrual_id', 'payroll_export_line_id', 'idempotency_key',
        'settled_by', 'settled_at',
    ];

    protected $casts = [
        'hours' => 'decimal:2',
        'multiplier' => 'decimal:2',
        'payable_hours' => 'decimal:2',
        'settled_at' => 'datetime',
    ];

    public function actual(): BelongsTo
    {
        return $this->belongsTo(OvertimeActualEntry::class, 'overtime_actual_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
