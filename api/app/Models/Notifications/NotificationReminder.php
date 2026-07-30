<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationReminder extends Model
{
    protected $table = 'notification_reminders';

    protected $fillable = [
        'tenant_id', 'source_type', 'source_id', 'user_id', 'event_key', 'due_at',
        'calendar_code', 'status', 'sent_at', 'payload',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'sent_at' => 'datetime',
        'payload' => 'array',
    ];
}
