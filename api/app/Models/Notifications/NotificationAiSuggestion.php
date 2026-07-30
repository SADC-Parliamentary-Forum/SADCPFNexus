<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationAiSuggestion extends Model
{
    protected $table = 'notification_ai_suggestions';

    protected $fillable = [
        'tenant_id', 'user_id', 'kind', 'suggestion', 'status', 'human_confirmed',
        'confirmed_by', 'confirmed_at', 'provider',
    ];

    protected $casts = [
        'suggestion' => 'array',
        'human_confirmed' => 'boolean',
        'confirmed_at' => 'datetime',
    ];
}
