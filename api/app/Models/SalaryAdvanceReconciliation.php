<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryAdvanceReconciliation extends Model
{
    protected $fillable = [
        'tenant_id',
        'salary_advance_request_id',
        'balance_register_id',
        'status',
        'expected_amount',
        'recovered_amount',
        'variance_amount',
        'reason',
        'resolution_notes',
        'outcome',
        'opened_by',
        'resolved_by',
        'resolved_at',
    ];

    protected function casts(): array
    {
        return [
            'expected_amount'  => 'float',
            'recovered_amount' => 'float',
            'variance_amount'  => 'float',
            'resolved_at'      => 'datetime',
        ];
    }

    public function advance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvanceRequest::class, 'salary_advance_request_id');
    }

    public function balanceRegister(): BelongsTo
    {
        return $this->belongsTo(BalanceRegister::class);
    }

    public function openedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'opened_by');
    }

    public function resolvedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'resolved_by');
    }

    public function isOpen(): bool
    {
        return $this->status === 'open';
    }
}
