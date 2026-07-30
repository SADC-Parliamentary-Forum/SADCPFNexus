<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventSchemaVersion extends Model
{
    protected $table = 'audit_event_schema_versions';

    protected $fillable = [
        'audit_event_type_id', 'schema_version', 'producer_version',
        'payload_schema', 'change_notes', 'effective_from',
    ];

    protected $casts = [
        'payload_schema' => 'array',
        'effective_from' => 'datetime',
    ];

    public function eventType(): BelongsTo
    {
        return $this->belongsTo(AuditEventType::class, 'audit_event_type_id');
    }
}
