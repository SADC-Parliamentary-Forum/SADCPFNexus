<?php

namespace App\Models\PlatformAudit;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AuditTrailGovernanceDecision extends Model
{
    protected $table = 'audit_trail_governance_decisions';

    public const STATUS_PENDING = 'pending';
    public const STATUS_DECIDED = 'decided';
    public const STATUS_NA = 'not_applicable';

    protected $fillable = [
        'tenant_id', 'decision_key', 'sort_order', 'title', 'description',
        'status', 'decision_notes', 'decided_by', 'decided_at',
    ];

    protected $casts = [
        'decided_at' => 'datetime',
    ];

    public function decidedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
