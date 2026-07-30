<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationRecipient extends Model
{
    protected $table = 'notification_recipients';

    protected $fillable = [
        'tenant_id',
        'notification_record_id',
        'user_id',
        'external_email',
        'external_name',
        'recipient_role',
        'position_snapshot',
        'department_snapshot',
        'language',
        'time_zone',
        'resolution_reason',
        'resolved_at',
        'status',
        'in_app_notification_id',
    ];

    public function isExternal(): bool
    {
        return $this->user_id === null && filled($this->external_email);
    }

    protected $casts = [
        'resolved_at' => 'datetime',
    ];
}
