<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeaveSegment extends Model
{
    protected $fillable = [
        'leave_request_id',
        'leave_type_id',
        'leave_type',
        'start_date',
        'end_date',
        'day_part',
        'calendar_days',
        'weekend_days',
        'public_holidays_excluded',
        'working_days',
        'balance_before',
        'amount_requested',
        'balance_after',
        'source_type',
        'source_id',
        'pay_treatment',
        'status',
        'certification_status',
        'eligible_days',
        'document_status',
        'certified_by',
        'certified_at',
        'certification_comments',
        'comments',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'calendar_days' => 'decimal:2',
        'weekend_days' => 'decimal:2',
        'public_holidays_excluded' => 'decimal:2',
        'working_days' => 'decimal:2',
        'balance_before' => 'decimal:2',
        'amount_requested' => 'decimal:2',
        'balance_after' => 'decimal:2',
        'eligible_days' => 'decimal:2',
        'certified_at' => 'datetime',
    ];

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function type(): BelongsTo
    {
        return $this->belongsTo(LeaveType::class, 'leave_type_id');
    }
}
