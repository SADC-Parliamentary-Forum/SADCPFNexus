<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class TimesheetAuditEvent extends Model
{
    protected $fillable = [
        'tenant_id', 'timesheet_id', 'overtime_requisition_id', 'overtime_actual_id',
        'actor_id', 'event_type', 'old_values', 'new_values', 'notes',
    ];

    protected $casts = [
        'old_values' => 'array',
        'new_values' => 'array',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function timesheet(): BelongsTo
    {
        return $this->belongsTo(Timesheet::class);
    }
}
