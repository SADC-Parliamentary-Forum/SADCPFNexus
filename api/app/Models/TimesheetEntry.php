<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetEntry extends Model
{
    use HasFactory;

    public const WORK_BUCKETS = ['delivery', 'meeting', 'communication', 'administration', 'other'];

    protected $fillable = [
        'timesheet_id',
        'project_id',
        'work_bucket',
        'activity_type',
        'work_assignment_id',
        'work_date',
        'hours',
        'overtime_hours',
        'description',
        'source_type',
        'source_record_id',
        'is_locked',
    ];

    protected $casts = [
        'work_date'  => 'date',
        'is_locked'  => 'bool',
    ];

    public function timesheet(): BelongsTo
    {
        return $this->belongsTo(Timesheet::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(TimesheetProject::class, 'project_id');
    }

    public function workAssignment(): BelongsTo
    {
        return $this->belongsTo(WorkAssignment::class, 'work_assignment_id');
    }
}
