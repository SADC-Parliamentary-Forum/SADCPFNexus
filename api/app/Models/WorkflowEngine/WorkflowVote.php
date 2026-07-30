<?php

namespace App\Models\WorkflowEngine;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class WorkflowVote extends Model
{
    protected $table = 'workflow_votes';

    protected $fillable = [
        'tenant_id', 'approval_request_id', 'step_index', 'workflow_decision_id',
        'voter_user_id', 'vote', 'comment', 'voted_at',
    ];

    protected $casts = [
        'voted_at' => 'datetime',
    ];

    public function voter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'voter_user_id');
    }
}
