<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class EmployeeScheduleAssignment extends Model
{
    protected $fillable = [
        'tenant_id', 'user_id', 'work_schedule_id',
        'effective_from', 'effective_to', 'assigned_by',
    ];

    protected $casts = [
        'effective_from' => 'date',
        'effective_to' => 'date',
    ];

    public function schedule(): BelongsTo
    {
        return $this->belongsTo(EmployeeWorkSchedule::class, 'work_schedule_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
