<?php

namespace App\Models\PlatformAudit;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditEventCheckpoint extends Model
{
    public const UPDATED_AT = null;

    protected $table = 'audit_event_checkpoints';

    protected $fillable = [
        'tenant_id', 'uuid', 'from_sequence', 'to_sequence', 'event_count',
        'chain_root_hash', 'chain_tip_hash', 'checkpoint_hash', 'algorithm',
        'status', 'created_by', 'meta', 'created_at',
    ];

    protected $casts = [
        'meta' => 'array',
        'created_at' => 'datetime',
        'from_sequence' => 'integer',
        'to_sequence' => 'integer',
        'event_count' => 'integer',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }
}
