<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class TimesheetEntry extends Model
{
    use HasFactory;

    protected $fillable = ['timesheet_id', 'work_date', 'hours', 'overtime_hours', 'description'];

    protected $casts = [
        'work_date' => 'date',
    ];

    public function timesheet()
    {
        return $this->belongsTo(Timesheet::class);
    }
}
