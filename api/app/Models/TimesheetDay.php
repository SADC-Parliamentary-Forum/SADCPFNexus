<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetDay extends Model
{
    protected $fillable = [
        'timesheet_id', 'work_date', 'expected_hours', 'ordinary_hours',
        'overtime_hours', 'day_status', 'leave_request_id', 'travel_request_id', 'notes',
    ];

    protected $casts = [
        'work_date' => 'date',
        'expected_hours' => 'decimal:2',
        'ordinary_hours' => 'decimal:2',
        'overtime_hours' => 'decimal:2',
    ];

    public function timesheet(): BelongsTo
    {
        return $this->belongsTo(Timesheet::class);
    }
}
