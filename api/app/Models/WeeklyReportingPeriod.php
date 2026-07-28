<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class WeeklyReportingPeriod extends Model
{
    protected $fillable = [
        'tenant_id', 'reference', 'start_date', 'end_date',
        'employee_due_at', 'supervisor_due_at', 'department_due_at', 'management_due_at',
        'status', 'configuration_snapshot',
    ];

    protected function casts(): array
    {
        return [
            'start_date' => 'date',
            'end_date' => 'date',
            'employee_due_at' => 'datetime',
            'supervisor_due_at' => 'datetime',
            'department_due_at' => 'datetime',
            'management_due_at' => 'datetime',
            'configuration_snapshot' => 'array',
        ];
    }

    public function reports(): HasMany
    {
        return $this->hasMany(WeeklyReport::class, 'period_id');
    }
}
