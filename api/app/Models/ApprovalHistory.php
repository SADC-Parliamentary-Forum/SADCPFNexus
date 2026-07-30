<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApprovalHistory extends Model
{
    protected $fillable = [
        'approval_request_id', 'user_id', 'action', 'step_index', 'comment',
        'stage_type', 'decision_type', 'authority_snapshot_id', 'package_hash',
    ];

    public function request(): BelongsTo
    {
        return $this->belongsTo(ApprovalRequest::class, 'approval_request_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
