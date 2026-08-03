<?php

namespace App\Models\AccessControl;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PermissionUsageEvent extends Model
{
    protected $table = 'permission_usage_events';

    protected $fillable = [
        'tenant_id',
        'actor_id',
        'permission_key',
        'decision',
        'reason_code',
        'source',
        'auditable_type',
        'auditable_id',
        'context',
        'correlation_id',
        'occurred_at',
    ];

    protected $casts = [
        'context' => 'array',
        'occurred_at' => 'datetime',
    ];

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }
}
