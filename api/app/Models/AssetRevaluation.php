<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetRevaluation extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'reference', 'status',
        'previous_book_value', 'proposed_value', 'reason', 'effective_date',
        'requested_by', 'approved_by', 'approved_at', 'approval_comments',
        'rejected_by', 'rejected_at', 'rejection_reason',
    ];

    protected function casts(): array
    {
        return [
            'previous_book_value' => 'decimal:2',
            'proposed_value' => 'decimal:2',
            'effective_date' => 'date',
            'approved_at' => 'datetime',
            'rejected_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function requester(): BelongsTo
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function approver(): BelongsTo
    {
        return $this->belongsTo(User::class, 'approved_by');
    }
}
