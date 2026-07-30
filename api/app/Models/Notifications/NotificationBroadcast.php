<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationBroadcast extends Model
{
    protected $table = 'notification_broadcasts';

    protected $fillable = [
        'tenant_id', 'uuid', 'title', 'body', 'impact', 'broadcast_type', 'audience',
        'status', 'created_by', 'submitted_by', 'approved_by', 'submitted_at',
        'approved_at', 'cancelled_at', 'scheduled_at', 'sent_at', 'idempotency_key',
        'cancel_reason',
    ];

    protected $casts = [
        'audience' => 'array',
        'submitted_at' => 'datetime',
        'approved_at' => 'datetime',
        'cancelled_at' => 'datetime',
        'scheduled_at' => 'datetime',
        'sent_at' => 'datetime',
    ];
}
