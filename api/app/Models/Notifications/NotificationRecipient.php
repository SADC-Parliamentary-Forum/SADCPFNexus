<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationRecipient extends Model
{
    protected $table = 'notification_recipients';

    protected $fillable = [
        'tenant_id',
        'notification_record_id',
        'user_id',
        'recipient_role',
        'position_snapshot',
        'department_snapshot',
        'language',
        'time_zone',
        'resolution_reason',
        'resolved_at',
        'status',
        'in_app_notification_id',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];
}
