<?php

namespace App\Models\PlatformAudit;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventChange extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_changes';

    protected $fillable = [
        'audit_event_id', 'field_name', 'field_label', 'data_classification',
        'old_value', 'new_value', 'old_value_hash', 'new_value_hash',
        'redaction_type', 'change_reason', 'created_at',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    protected static function booted(): void
    {
        static::updating(fn () => false);
        static::deleting(fn () => false);
    }

    public function event(): BelongsTo
    {
        return $this->belongsTo(AuditEvent::class, 'audit_event_id');
    }
}
