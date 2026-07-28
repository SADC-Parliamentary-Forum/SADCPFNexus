<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class AccountInvitation extends Model
{
    public const STATUS_PENDING = 'pending';
    public const STATUS_ACCEPTED = 'accepted';
    public const STATUS_REVOKED = 'revoked';
    public const STATUS_EXPIRED = 'expired';
    public const STATUS_SUPERSEDED = 'superseded';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'invited_by_id',
        'email',
        'token_hash',
        'status',
        'expires_at',
        'accepted_at',
        'revoked_at',
        'revoked_by_id',
        'superseded_by_id',
    ];

    protected $casts = [
        'expires_at' => 'datetime',
        'accepted_at' => 'datetime',
        'revoked_at' => 'datetime',
    ];

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function invitedBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'invited_by_id');
    }

    public function isUsable(): bool
    {
        return $this->status === self::STATUS_PENDING
            && $this->expires_at !== null
            && $this->expires_at->isFuture();
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function findUsableByToken(string $token): ?self
    {
        $invitation = self::query()
            ->where('token_hash', self::hashToken($token))
            ->with('user')
            ->first();

        if (! $invitation || ! $invitation->isUsable()) {
            return null;
        }

        return $invitation;
    }
}
