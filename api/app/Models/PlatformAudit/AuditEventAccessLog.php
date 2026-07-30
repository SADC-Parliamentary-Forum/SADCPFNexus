<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;

class AuditEventAccessLog extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_access_logs';

    protected $fillable = [
        'tenant_id', 'viewer_user_id', 'access_type', 'purpose', 'filters',
        'target_event_id', 'ip_address', 'accessed_at', 'created_at',
    ];

    protected $casts = [
        'filters' => 'array',
        'accessed_at' => 'datetime',
        'created_at' => 'datetime',
    ];
}
