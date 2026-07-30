<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationAckRecipient extends Model
{
    protected $table = 'notification_ack_recipients';

    protected $fillable = [
        'tenant_id', 'campaign_id', 'user_id', 'notification_id', 'status',
        'acknowledged_at', 'last_reminded_at', 'reminder_count', 'escalated_at',
    ];

    protected $casts = [
        'acknowledged_at' => 'datetime',
        'last_reminded_at' => 'datetime',
        'escalated_at' => 'datetime',
        'reminder_count' => 'integer',
    ];
}
