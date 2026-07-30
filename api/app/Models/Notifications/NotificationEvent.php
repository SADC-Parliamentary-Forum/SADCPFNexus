<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationEvent extends Model
{
    protected $table = 'notification_events';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'outbox_id',
        'event_key',
        'event_type',
        'source_module',
        'source_type',
        'source_id',
        'source_reference_snapshot',
        'actor_id',
        'occurred_at',
        'importance',
        'confidentiality',
        'correlation_id',
        'idempotency_key',
        'payload',
        'status',
    ];

    protected $casts = [
        'payload' => 'array',
        'occurred_at' => 'datetime',
    ];
}
