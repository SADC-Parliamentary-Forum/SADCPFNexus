<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WeeklyReportExemption extends Model
{
    protected $fillable = [
        'tenant_id', 'period_id', 'employee_id', 'reason', 'leave_request_id', 'granted_by', 'notes',
    ];

    public function period(): BelongsTo
    {
        return $this->belongsTo(WeeklyReportingPeriod::class, 'period_id');
    }

    public function employee(): BelongsTo
    {
        return $this->belongsTo(User::class, 'employee_id');
    }
}
