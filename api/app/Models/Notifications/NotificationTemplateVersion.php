<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationTemplateVersion extends Model
{
    protected $table = 'notification_template_versions';

    protected $fillable = [
        'tenant_id',
        'template_key',
        'version',
        'locale',
        'status',
        'subject',
        'body',
        'privacy_subject',
        'approved_by',
        'approved_at',
        'published_by',
        'published_at',
    ];

    protected $casts = [
        'approved_at' => 'datetime',
        'published_at' => 'datetime',
        'version' => 'integer',
    ];
}
