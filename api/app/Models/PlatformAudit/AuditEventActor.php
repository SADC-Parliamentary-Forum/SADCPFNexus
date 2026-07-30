<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventActor extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_actors';

    protected $fillable = [
        'audit_event_id', 'person_id', 'account_id', 'display_name', 'employee_number',
        'position_id', 'position_title', 'department_id', 'department_name',
        'roles_used', 'authority_id', 'authority_scope', 'delegation_reference',
        'acting_reference', 'authentication_strength', 'created_at',
    ];

    protected $casts = [
        'roles_used' => 'array',
        'created_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
