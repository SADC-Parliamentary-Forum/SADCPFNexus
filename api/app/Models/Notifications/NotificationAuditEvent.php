<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationAuditEvent extends Model
{
    protected $table = 'notification_audit_events';

    protected $fillable = [
        'tenant_id',
        'entity_type',
        'entity_id',
        'action',
        'actor_id',
        'payload',
        'occurred_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'datetime',
    ];
}
