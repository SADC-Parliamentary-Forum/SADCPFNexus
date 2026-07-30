<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationOutbox extends Model
{
    protected $table = 'notification_outbox';

    protected $fillable = [
        'tenant_id',
        'uuid',
        'event_type',
        'source_module',
        'source_type',
        'source_id',
        'idempotency_key',
        'schema_version',
        'actor_id',
        'correlation_id',
        'payload',
        'status',
        'attempts',
        'available_at',
        'published_at',
        'last_error',
    ];

    protected $casts = [
        'payload' => 'array',
        'available_at' => 'datetime',
        'published_at' => 'datetime',
        'attempts' => 'integer',
    ];
}
