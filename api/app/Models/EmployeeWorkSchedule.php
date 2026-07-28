<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class EmployeeWorkSchedule extends Model
{
    protected $fillable = [
        'tenant_id', 'name', 'code', 'is_default', 'working_days',
        'start_time', 'end_time', 'lunch_start', 'lunch_end',
        'ordinary_hours_per_day', 'is_active',
    ];

    protected $casts = [
        'working_days' => 'array',
        'is_default' => 'boolean',
        'is_active' => 'boolean',
        'ordinary_hours_per_day' => 'decimal:2',
    ];

    public function assignments(): HasMany
    {
        return $this->hasMany(EmployeeScheduleAssignment::class, 'work_schedule_id');
    }
}
