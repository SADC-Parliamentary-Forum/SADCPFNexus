<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditEffortEntry extends Model
{
    protected $fillable = [
        'tenant_id', 'effort_budget_id', 'engagement_id', 'auditor_user_id',
        'work_date', 'hours', 'activity', 'notes', 'created_by',
    ];

    protected $casts = [
        'work_date' => 'date',
        'hours' => 'decimal:2',
    ];
}
