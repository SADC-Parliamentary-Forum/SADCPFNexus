<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetTransfer extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'from_user_id', 'to_user_id', 'status', 'reason',
        'condition', 'override_reason', 'override_notes', 'initiated_by',
        'outgoing_confirmed_at', 'outgoing_confirmed_by', 'accepted_at',
        'accepted_by', 'completed_at',
    ];

    protected function casts(): array
    {
        return [
            'outgoing_confirmed_at' => 'datetime',
            'accepted_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }
}
