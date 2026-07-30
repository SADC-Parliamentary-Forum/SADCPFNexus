<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationDigest extends Model
{
    protected $table = 'notification_digests';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'digest_type',
        'period_start',
        'period_end',
        'status',
        'ai_summary',
        'ai_summary_provider',
        'sent_at',
    ];

    protected $casts = [
        'period_start' => 'date',
        'period_end' => 'date',
        'sent_at' => 'datetime',
    ];
}
