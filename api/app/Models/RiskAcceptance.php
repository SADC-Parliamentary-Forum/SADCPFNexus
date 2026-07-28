<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RiskAcceptance extends Model
{
    protected $fillable = [
        'tenant_id', 'risk_id', 'justification', 'expires_at', 'status',
        'residual_likelihood', 'residual_impact', 'residual_score', 'residual_level',
        'requested_by', 'approved_by', 'approved_at', 'decision_notes',
    ];

    protected $casts = [
        'expires_at' => 'date',
        'approved_at' => 'datetime',
        'residual_likelihood' => 'integer',
        'residual_impact' => 'integer',
        'residual_score' => 'integer',
    ];

    public function risk(): BelongsTo
    {
        return $this->belongsTo(Risk::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }

    public function isPending(): bool
    {
        return $this->status === 'pending';
    }
}
