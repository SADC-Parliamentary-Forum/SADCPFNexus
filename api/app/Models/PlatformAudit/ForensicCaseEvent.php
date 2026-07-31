<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ForensicCaseEvent extends Model
{
    protected $table = 'forensic_case_events';

    protected $fillable = [
        'forensic_case_id', 'audit_event_id', 'linked_by', 'linked_at', 'notes',
    ];

    protected $casts = [
        'linked_at' => 'datetime',
    ];

    public function forensicCase(): BelongsTo
    {
        return $this->belongsTo(ForensicCase::class, 'forensic_case_id');
    }

    public function auditEvent(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
