<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationCoalesceItem extends Model
{
    protected $table = 'notification_coalesce_items';

    protected $fillable = [
        'bucket_id', 'event_key', 'summary', 'payload',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
