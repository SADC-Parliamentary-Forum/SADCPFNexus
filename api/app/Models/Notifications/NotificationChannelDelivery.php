<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationChannelDelivery extends Model
{
    protected $table = 'notification_channel_deliveries';

    protected $fillable = [
        'tenant_id',
        'recipient_id',
        'channel',
        'provider',
        'destination_snapshot',
        'template_version_id',
        'rendered_subject',
        'rendered_body_hash',
        'provider_message_id',
        'queue_priority',
        'status',
        'scheduled_at',
        'queued_at',
        'sent_at',
        'delivered_at',
        'failed_at',
        'failure_code',
        'attempt_count',
        'suppressed',
        'suppression_reason',
    ];

    protected $casts = [
        'scheduled_at' => 'datetime',
        'queued_at' => 'datetime',
        'sent_at' => 'datetime',
        'delivered_at' => 'datetime',
        'failed_at' => 'datetime',
        'attempt_count' => 'integer',
        'suppressed' => 'boolean',
    ];
}
