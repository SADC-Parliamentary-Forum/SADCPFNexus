<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AssetQrToken extends Model
{
    protected $fillable = [
        'tenant_id', 'asset_id', 'token', 'generated_at', 'generated_by',
        'revoked_at', 'revoke_reason',
    ];

    protected function casts(): array
    {
        return [
            'generated_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function asset(): BelongsTo
    {
        return $this->belongsTo(Asset::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }
}
