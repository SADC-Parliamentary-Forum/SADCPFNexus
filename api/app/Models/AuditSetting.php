<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditSetting extends Model
{
    protected $fillable = [
        'tenant_id', 'plan_approval_mode', 'charter_configured', 'charter_notes', 'notification_templates',
    ];

    protected $casts = [
        'charter_configured' => 'boolean',
        'notification_templates' => 'array',
    ];
}
