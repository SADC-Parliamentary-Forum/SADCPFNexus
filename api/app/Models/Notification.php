<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'uuid',
        'type',
        'trigger',
        'category',
        'importance',
        'confidentiality',
        'delivery_class',
        'action_required',
        'subject',
        'body',
        'meta',
        'secure_route',
        'is_read',
        'read_at',
        'acknowledged_at',
        'archived_at',
        'event_id',
        'template_version_id',
    ];

    protected $casts = [
        'meta' => 'array',
        'is_read' => 'boolean',
        'action_required' => 'boolean',
        'read_at' => 'datetime',
        'acknowledged_at' => 'datetime',
        'archived_at' => 'datetime',
    ];
}
