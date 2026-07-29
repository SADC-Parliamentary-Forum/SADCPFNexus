<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditPlanVersion extends Model
{
    protected $fillable = [
        'tenant_id', 'audit_plan_id', 'version', 'snapshot', 'change_summary', 'created_by',
    ];

    protected $casts = ['snapshot' => 'array'];

    public function plan(): BelongsTo
    {
        return $this->belongsTo(AuditPlan::class, 'audit_plan_id');
    }
}
