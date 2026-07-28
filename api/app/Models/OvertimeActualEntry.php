<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

class OvertimeActualEntry extends Model
{
    public const DRAFT = 'draft';
    public const SUBMITTED = 'submitted';
    public const VERIFIED = 'verified';
    public const HR_VALIDATED = 'hr_validated';
    public const SETTLED = 'settled';
    public const REJECTED = 'rejected';

    protected $fillable = [
        'tenant_id', 'overtime_requisition_id', 'user_id', 'timesheet_id',
        'work_date', 'actual_start', 'actual_end', 'actual_hours', 'planned_hours',
        'day_type', 'multiplier', 'payable_hours', 'status',
        'verified_by', 'verified_at', 'hr_validated_by', 'hr_validated_at', 'notes',
    ];

    protected $casts = [
        'work_date' => 'date',
        'actual_hours' => 'decimal:2',
        'planned_hours' => 'decimal:2',
        'multiplier' => 'decimal:2',
        'payable_hours' => 'decimal:2',
        'verified_at' => 'datetime',
        'hr_validated_at' => 'datetime',
    ];

    public function requisition(): BelongsTo
    {
        return $this->belongsTo(OvertimeRequisition::class, 'overtime_requisition_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function settlement(): HasOne
    {
        return $this->hasOne(OvertimeSettlement::class, 'overtime_actual_id');
    }
}
