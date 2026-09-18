<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ContractAuthorityDelegation extends Model
{
    protected $fillable = [
        'tenant_id', 'delegator_role', 'delegate_user_id', 'action', 'reason',
        'effective_from', 'expires_at', 'is_active', 'created_by',
    ];

    protected $casts = [
        'effective_from' => 'datetime',
        'expires_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function delegate(): BelongsTo
    {
        return $this->belongsTo(User::class, 'delegate_user_id');
    }

    /** Whether this delegation is currently in force for the given action. */
    public function isLiveFor(string $action): bool
    {
        if (! $this->is_active) {
            return false;
        }
        if ($this->action !== null && $this->action !== $action) {
            return false;
        }

        return now()->betweenIncluded($this->effective_from, $this->expires_at);
    }
}
