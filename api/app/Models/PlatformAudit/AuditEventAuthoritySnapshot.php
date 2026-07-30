<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventAuthoritySnapshot extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_authority_snapshots';

    protected $fillable = [
        'audit_event_id', 'roles', 'permissions_used', 'authority_grants',
        'delegation', 'acting_appointment', 'created_at',
    ];

    protected $casts = [
        'roles' => 'array',
        'permissions_used' => 'array',
        'authority_grants' => 'array',
        'delegation' => 'array',
        'acting_appointment' => 'array',
        'created_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
