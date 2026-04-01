<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Notification extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'type',
        'trigger',
        'subject',
        'body',
        'meta',
        'is_read',
        'read_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'is_read' => 'boolean',
        'read_at' => 'datetime',
    ];
}
