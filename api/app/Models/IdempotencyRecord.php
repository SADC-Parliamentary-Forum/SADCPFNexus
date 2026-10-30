<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;

/**
 * Stored outcome of a write request sent with an Idempotency-Key header.
 * Written and read only by EnforceIdempotencyKey; pruned after expiry.
 */
class IdempotencyRecord extends Model
{
    use Prunable;

    protected $fillable = [
        'tenant_id',
        'user_id',
        'idempotency_key',
        'method',
        'path',
        'request_fingerprint',
        'status',
        'response_status',
        'response_body',
        'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'response_status' => 'integer',
            'expires_at' => 'datetime',
        ];
    }

    public function prunable(): Builder
    {
        return static::where('expires_at', '<', now());
    }
}
