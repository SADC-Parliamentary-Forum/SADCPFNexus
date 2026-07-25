<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SalaryAdvancePolicyException extends Model
{
    public const TYPES = [
        'outstanding_balance',
        'max_percentage',
        'concurrent',
        'other',
    ];

    public const STATUSES = [
        'pending',
        'approved',
        'rejected',
        'revoked',
    ];

    protected $fillable = [
        'tenant_id',
        'employee_id',
        'exception_type',
        'status',
        'reason',
        'justification',
        'decision_notes',
        'effective_from',
        'effective_to',
        'policy_version_id',
        'linked_advance_id',
        'requested_by',
        'approved_by',
        'approved_at',
        'revoked_by',
        'revoked_at',
        'applies_automatically',
    ];

    protected $casts = [
        'effective_from'        => 'date',
        'effective_to'          => 'date',
        'approved_at'           => 'datetime',
        'revoked_at'            => 'datetime',
        'applies_automatically' => 'boolean',
    ];

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }

    public function requestedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approvedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function revokedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'revoked_by');
    }

    public function linkedAdvance(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvanceRequest::class, 'linked_advance_id');
    }

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(SalaryAdvancePolicyVersion::class, 'policy_version_id');
    }

    public function isApproved(): bool
    {
        return $this->status === 'approved';
    }

    public function isActiveOn(?\DateTimeInterface $on = null): bool
    {
        if (! $this->isApproved()) {
            return false;
        }

        $on = $on ? \Carbon\Carbon::instance($on)->startOfDay() : now()->startOfDay();
        if ($this->effective_from && $on->lt($this->effective_from->startOfDay())) {
            return false;
        }
        if ($this->effective_to && $on->gt($this->effective_to->endOfDay())) {
            return false;
        }

        return true;
    }
}
