<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventIntegrityRecord extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_integrity_records';

    protected $fillable = [
        'audit_event_id', 'canonical_payload_hash', 'previous_hash', 'event_hash',
        'algorithm', 'key_reference', 'verification_status', 'verified_at',
        'checkpoint_id', 'created_at',
    ];

    protected $casts = [
        'verified_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
