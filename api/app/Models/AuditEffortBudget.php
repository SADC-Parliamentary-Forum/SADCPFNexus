<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AuditEffortBudget extends Model
{
    protected $fillable = [
        'tenant_id', 'audit_plan_id', 'engagement_id', 'auditor_user_id',
        'budget_hours', 'label', 'created_by',
    ];

    protected $casts = [
        'budget_hours' => 'decimal:2',
    ];

    public function entries(): HasMany
    {
        return $this->hasMany(AuditEffortEntry::class, 'effort_budget_id');
    }
}
