<?php

namespace App\Models\WorkflowEngine;

use Illuminate\Database\Eloquent\Model;

class WorkflowWorkingCalendar extends Model
{
    protected $table = 'workflow_working_calendars';

    protected $fillable = [
        'tenant_id', 'code', 'name', 'working_days', 'day_start', 'day_end',
        'holidays', 'timezone', 'is_default',
    ];

    protected $casts = [
        'working_days' => 'array',
        'holidays' => 'array',
        'is_default' => 'boolean',
    ];
}
