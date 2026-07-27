<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveType extends Model
{
    protected $fillable = [
        'tenant_id',
        'policy_version_id',
        'code',
        'name',
        'annual_entitlement',
        'accrual_rate',
        'accrual_unit',
        'cycle',
        'is_paid',
        'allow_negative_balance',
        'allow_half_day',
        'requires_attachment',
        'medical_certificate_after_days',
        'rules',
        'is_active',
    ];

    protected $casts = [
        'annual_entitlement' => 'decimal:2',
        'accrual_rate' => 'decimal:4',
        'is_paid' => 'boolean',
        'allow_negative_balance' => 'boolean',
        'allow_half_day' => 'boolean',
        'requires_attachment' => 'boolean',
        'rules' => 'array',
        'is_active' => 'boolean',
    ];

    public function policyVersion(): BelongsTo
    {
        return $this->belongsTo(LeavePolicyVersion::class, 'policy_version_id');
    }
}
