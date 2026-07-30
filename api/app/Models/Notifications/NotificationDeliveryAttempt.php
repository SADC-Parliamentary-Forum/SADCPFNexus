<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationDeliveryAttempt extends Model
{
    protected $table = 'notification_delivery_attempts';

    protected $fillable = [
        'channel_delivery_id',
        'attempt_number',
        'attempted_at',
        'provider_request_id',
        'result',
        'response_code',
        'response_summary',
        'temporary_failure',
        'next_retry_at',
        'duration_ms',
    ];

    protected $casts = [
        'attempted_at' => 'datetime',
        'temporary_failure' => 'boolean',
        'next_retry_at' => 'datetime',
        'attempt_number' => 'integer',
        'duration_ms' => 'integer',
    ];
}
