<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationExternalToken extends Model
{
    protected $table = 'notification_external_tokens';

    protected $fillable = [
        'tenant_id', 'uuid', 'token_hash', 'recipient_email', 'recipient_name',
        'subject', 'minimal_body', 'secure_route', 'source_module', 'source_id',
        'expires_at', 'viewed_at', 'revoked_at',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'viewed_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];
}
