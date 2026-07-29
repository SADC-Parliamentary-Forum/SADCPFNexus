<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditReportDistribution extends Model
{
    protected $fillable = [
        'tenant_id', 'report_id', 'recipient_user_id', 'recipient_email',
        'recipient_name', 'distributed_by', 'distributed_at',
    ];

    protected $casts = ['distributed_at' => 'datetime'];
}
