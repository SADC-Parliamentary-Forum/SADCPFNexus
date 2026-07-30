<?php

namespace App\Models\PlatformAudit;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class AuditEvent extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_events';

    protected $fillable = [
        'uuid', 'tenant_id', 'sequence_number', 'event_type_id', 'event_key',
        'schema_version', 'producer_version', 'category', 'severity', 'outcome',
        'occurred_at', 'received_at', 'actor_type', 'actor_id', 'actor_snapshot',
        'principal_id', 'delegation_id', 'acting_appointment_id',
        'subject_type', 'subject_id', 'subject_snapshot',
        'source_module', 'action', 'reason', 'correlation_id', 'causation_event_id',
        'request_id', 'session_reference', 'ip_address', 'user_agent', 'channel',
        'payload', 'previous_event_hash', 'event_hash', 'checkpoint_id',
        'retention_class', 'confidentiality', 'idempotency_key',
        'migration_status', 'legacy_audit_log_id', 'created_at',
    ];

    protected $casts = [
        'actor_snapshot' => 'array',
        'subject_snapshot' => 'array',
        'payload' => 'array',
        'occurred_at' => 'datetime',
        'received_at' => 'datetime',
        'created_at' => 'datetime',
        'sequence_number' => 'integer',
        'schema_version' => 'integer',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(AuditEventType::class, 'event_type_id');
    }

    public function changes(): HasMany
    {
        return $this->hasMany(AuditEventChange::class, 'audit_event_id');
    }

    public function actorDetail(): HasOne
    {
        return $this->hasOne(AuditEventActor::class, 'audit_event_id');
    }

    public function subjectDetail(): HasOne
    {
        return $this->hasOne(AuditEventSubject::class, 'audit_event_id');
    }

    public function context(): HasOne
    {
        return $this->hasOne(AuditEventContext::class, 'audit_event_id');
    }

    public function authoritySnapshot(): HasOne
    {
        return $this->hasOne(AuditEventAuthoritySnapshot::class, 'audit_event_id');
    }

    public function integrityRecord(): HasOne
    {
        return $this->hasOne(AuditEventIntegrityRecord::class, 'audit_event_id');
    }
}
