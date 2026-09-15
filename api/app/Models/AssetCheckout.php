<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetCheckout extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'borrower_id', 'purpose', 'checked_out_at',
        'expected_return_at', 'returned_at', 'accessories', 'condition_out',
        'condition_in', 'damage_reported', 'issued_by', 'received_by', 'notes',
        'overdue_notified',
    ];

    protected function casts(): array
    {
        return [
            'checked_out_at' => 'datetime',
            'expected_return_at' => 'datetime',
            'returned_at' => 'datetime',
            'accessories' => 'array',
            'damage_reported' => 'boolean',
            'overdue_notified' => 'boolean',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function borrower(): BelongsTo
    {
        return $this->belongsTo(User::class, 'borrower_id');
    }
}
