<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationDeadLetter extends Model
{
    protected $table = 'notification_dead_letters';

    protected $fillable = [
        'tenant_id',
        'channel_delivery_id',
        'outbox_id',
        'failure_code',
        'failure_summary',
        'status',
        'resolved_by',
        'resolved_at',
        'resolution_notes',
    ];

    protected $casts = [
        'resolved_at' => 'datetime',
    ];
}
