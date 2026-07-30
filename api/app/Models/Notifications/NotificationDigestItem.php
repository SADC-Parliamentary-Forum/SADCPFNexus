<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationDigestItem extends Model
{
    protected $table = 'notification_digest_items';

    protected $fillable = [
        'digest_id',
        'channel_delivery_id',
        'summary',
    ];

}
