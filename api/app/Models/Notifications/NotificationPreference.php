<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationPreference extends Model
{
    protected $table = 'notification_preferences';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'category',
        'in_app_enabled',
        'email_enabled',
        'push_enabled',
        'digest_mode',
        'quiet_hours_start',
        'quiet_hours_end',
        'preferred_language',
    ];

    protected $casts = [
        'in_app_enabled' => 'boolean',
        'email_enabled' => 'boolean',
        'push_enabled' => 'boolean',
    ];
}
