<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventContext extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_contexts';

    protected $fillable = [
        'audit_event_id', 'request_id', 'session_reference', 'ip_address',
        'user_agent', 'channel', 'url', 'extra', 'created_at',
    ];

    protected $casts = [
        'extra' => 'array',
        'created_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
