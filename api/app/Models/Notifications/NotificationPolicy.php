<?php

namespace App\Models\Notifications;

use Illuminate\Database\Eloquent\Model;

class NotificationPolicy extends Model
{
    protected $table = 'notification_policies';

    protected $fillable = [
        'tenant_id',
        'event_key',
        'version',
        'status',
        'category',
        'delivery_class',
        'importance',
        'confidentiality',
        'mandatory',
        'digest_eligible',
        'action_required',
        'in_app_enabled',
        'email_enabled',
        'push_enabled',
        'template_key',
        'queue_priority',
        'channels',
        'reminder_policy',
        'escalation_policy',
        'retry_profile',
        'effective_from',
        'effective_to',
    ];

    protected $casts = [
        'mandatory' => 'boolean',
        'digest_eligible' => 'boolean',
        'action_required' => 'boolean',
        'in_app_enabled' => 'boolean',
        'email_enabled' => 'boolean',
        'push_enabled' => 'boolean',
        'channels' => 'array',
        'reminder_policy' => 'array',
        'escalation_policy' => 'array',
        'retry_profile' => 'array',
        'effective_from' => 'datetime',
        'effective_to' => 'datetime',
        'version' => 'integer',
    ];
}
