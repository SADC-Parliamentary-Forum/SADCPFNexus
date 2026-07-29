<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditPlanApproval extends Model
{
    protected $fillable = [
        'tenant_id', 'audit_plan_id', 'plan_version', 'action', 'comments', 'actor_id',
    ];
}
