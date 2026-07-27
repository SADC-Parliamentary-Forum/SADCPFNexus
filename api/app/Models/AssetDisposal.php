<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetDisposal extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'reference', 'status', 'reason', 'method',
        'justification', 'estimated_value', 'proceeds', 'accounting_reference',
        'requested_by', 'hod_recommended_by', 'hod_recommended_at', 'hod_comments',
        'finance_reviewed_by', 'finance_reviewed_at', 'finance_comments',
        'approved_by', 'approved_at', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'estimated_value' => 'decimal:2',
            'proceeds' => 'decimal:2',
            'hod_recommended_at' => 'datetime',
            'finance_reviewed_at' => 'datetime',
            'approved_at' => 'datetime',
            'completed_at' => 'datetime',
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
}
