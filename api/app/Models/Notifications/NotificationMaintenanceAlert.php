<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationMaintenanceAlert extends Model
{
    protected $table = 'notification_maintenance_alerts';

    protected $fillable = [
        'tenant_id', 'uuid', 'broadcast_id', 'title', 'body', 'starts_at', 'ends_at',
        'revalidate_at', 'status', 'created_by',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'revalidate_at' => 'datetime',
    ];
}
