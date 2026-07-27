<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class LeavePayrollImpact extends Model
{
    protected $fillable = [
        'tenant_id',
        'leave_request_id',
        'user_id',
        'leave_type',
        'start_date',
        'end_date',
        'pay_treatment',
        'status',
        'payload',
        'sent_at',
    ];

    protected $casts = [
        'start_date' => 'date',
        'end_date' => 'date',
        'payload' => 'array',
        'sent_at' => 'datetime',
    ];

    public function leaveRequest(): BelongsTo
    {
        return $this->belongsTo(LeaveRequest::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
