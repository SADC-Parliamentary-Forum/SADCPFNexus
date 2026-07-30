<?php

namespace App\Models\PeopleAuthority;

use Illuminate\Database\Eloquent\Model;

class IdentityAuditEvent extends Model
{
    protected $table = 'identity_audit_events';

    protected $fillable = [
        'tenant_id',
        'event_type',
        'actor_user_id',
        'person_id',
        'subject_type',
        'subject_id',
        'payload',
        'privacy_level',
    ];

    protected $casts = [
        'payload' => 'array',
    ];
}
