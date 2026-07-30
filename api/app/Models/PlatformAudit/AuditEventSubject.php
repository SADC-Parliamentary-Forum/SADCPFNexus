<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventSubject extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_subjects';

    protected $fillable = [
        'audit_event_id', 'subject_type', 'subject_id', 'business_reference',
        'display_label', 'snapshot', 'created_at',
    ];

    protected $casts = [
        'snapshot' => 'array',
        'created_at' => 'datetime',
    ];

    public function event(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
