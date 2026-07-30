<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationCoalesceBucket extends Model
{
    protected $table = 'notification_coalesce_buckets';

    protected $fillable = [
        'tenant_id', 'user_id', 'coalesce_key', 'status', 'critical',
        'window_starts_at', 'window_ends_at', 'flushed_at', 'flushed_notification_id',
    ];

    protected $casts = [
        'critical' => 'boolean',
        'window_starts_at' => 'datetime',
        'window_ends_at' => 'datetime',
        'flushed_at' => 'datetime',
    ];
}
