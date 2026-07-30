<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationSuppression extends Model
{
    protected $table = 'notification_suppressions';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'channel',
        'destination',
        'reason',
        'scope',
        'expires_at',
        'created_by',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
    ];
}
