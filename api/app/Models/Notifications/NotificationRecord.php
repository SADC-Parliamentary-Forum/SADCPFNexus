<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationRecord extends Model
{
    protected $table = 'notification_records';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'event_id',
        'notification_type',
        'template_key',
        'template_version_id',
        'importance',
        'confidentiality',
        'delivery_class',
        'action_required',
        'secure_route',
        'expires_at',
        'status',
        'cancelled_at',
        'superseded_by_id',
    ];

    protected $casts = [
        'action_required' => 'boolean',
        'expires_at' => 'datetime',
        'cancelled_at' => 'datetime',
    ];
}
