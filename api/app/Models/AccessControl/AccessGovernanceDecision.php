<?php

namespace App\Models\AccessControl;

use Illuminate\Database\Eloquent\Model;

class AccessGovernanceDecision extends Model
{
    protected $table = 'access_governance_decisions';

    protected $fillable = [
        'tenant_id',
        'topic',
        'status',
        'decision_notes',
        'owner_user_id',
        'due_at',
        'decided_at',
        'meta',
    ];

    protected $casts = [
        'due_at' => 'datetime',
        'decided_at' => 'datetime',
        'meta' => 'array',
    ];
}
