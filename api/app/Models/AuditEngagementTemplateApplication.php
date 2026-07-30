<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditEngagementTemplateApplication extends Model
{
    protected $fillable = [
        'tenant_id', 'engagement_id', 'donor_template_id', 'report_id',
        'applied_snapshot', 'applied_by',
    ];

    protected $casts = [
        'applied_snapshot' => 'array',
    ];
}
