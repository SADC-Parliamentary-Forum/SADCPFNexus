<?php

namespace App\Models\Notifications;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class NotificationGovernanceDecision extends Model
{
    protected $table = 'notification_governance_decisions';

    public const STATUS_PENDING = 'pending';
    public const STATUS_DECIDED = 'decided';
    public const STATUS_NOT_APPLICABLE = 'not_applicable';

    protected $fillable = [
        'tenant_id',
        'decision_key',
        'sort_order',
        'title',
        'description',
        'status',
        'decision_notes',
        'decided_by',
        'decided_at',
    ];

    protected function casts(): array
    {
        return [
            'sort_order' => 'integer',
            'decided_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function decidedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'decided_by');
    }
}
