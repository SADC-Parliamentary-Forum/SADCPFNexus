<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class OvertimeRequisition extends Model
{
    public const DRAFT = 'draft';
    public const SUBMITTED = 'submitted';
    public const RECOMMENDED = 'recommended';
    public const APPROVED = 'approved';
    public const REJECTED = 'rejected';
    public const CANCELLED = 'cancelled';
    public const COMPLETED = 'completed';

    protected $fillable = [
        'tenant_id', 'reference', 'requested_by', 'department_id',
        'work_date', 'planned_start', 'planned_end', 'planned_hours',
        'day_type', 'reason', 'work_location', 'assignment_id', 'pif_id',
        'is_emergency', 'emergency_justification', 'status',
        'recommended_by', 'recommended_at', 'approved_by', 'approved_at',
        'rejected_by', 'rejected_at', 'rejection_reason',
    ];

    protected $casts = [
        'work_date' => 'date',
        'planned_hours' => 'decimal:2',
        'is_emergency' => 'boolean',
        'recommended_at' => 'datetime',
        'approved_at' => 'datetime',
        'rejected_at' => 'datetime',
    ];

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function employees(): HasMany
    {
        return $this->hasMany(OvertimeRequisitionEmployee::class);
    }

    public function actuals(): HasMany
    {
        return $this->hasMany(OvertimeActualEntry::class);
    }

    public function isApproved(): bool
    {
        return $this->status === self::APPROVED;
    }
}
