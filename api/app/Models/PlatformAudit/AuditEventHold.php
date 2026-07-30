<?php

namespace App\Models\PlatformAudit;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventHold extends Model
{
    protected $table = 'audit_event_holds';

    protected $fillable = [
        'tenant_id', 'uuid', 'hold_type', 'scope_type', 'scope_value',
        'audit_event_id', 'reason', 'status', 'placed_by', 'placed_at',
        'released_by', 'released_at',
    ];

    protected $casts = [
        'placed_at' => 'datetime',
        'released_at' => 'datetime',
    ];

    public function placer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'placed_by');
    }
}
