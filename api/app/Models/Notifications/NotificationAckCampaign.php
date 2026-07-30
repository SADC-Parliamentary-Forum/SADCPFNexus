<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationAckCampaign extends Model
{
    protected $table = 'notification_ack_campaigns';

    protected $fillable = [
        'tenant_id', 'uuid', 'title', 'body', 'importance', 'required', 'deadline_at',
        'reminder_offsets_hours', 'escalation_policy', 'audience', 'secure_route',
        'status', 'created_by', 'activated_at', 'closed_at',
    ];

    protected $casts = [
        'required' => 'boolean',
        'deadline_at' => 'datetime',
        'reminder_offsets_hours' => 'array',
        'escalation_policy' => 'array',
        'audience' => 'array',
        'activated_at' => 'datetime',
        'closed_at' => 'datetime',
    ];
}
