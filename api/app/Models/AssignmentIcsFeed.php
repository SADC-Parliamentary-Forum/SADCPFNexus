<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Str;

class AssignmentIcsFeed extends Model
{
    public const SCOPE_MINE = 'mine';

    protected $fillable = [
        'tenant_id',
        'user_id',
        'token_hash',
        'token_encrypted',
        'scope',
        'last_used_at',
        'revoked_at',
    ];

    protected $hidden = [
        'token_hash',
        'token_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'last_used_at' => 'datetime',
            'revoked_at' => 'datetime',
        ];
    }

    public function tenant(): BelongsTo
    {
        return $this->belongsTo(Tenant::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isActive(): bool
    {
        return $this->revoked_at === null;
    }

    public static function hashToken(string $token): string
    {
        return hash('sha256', $token);
    }

    public static function generatePlainToken(): string
    {
        return Str::random(48);
    }

    public function setPlainToken(string $plain): void
    {
        $this->token_hash = self::hashToken($plain);
        $this->token_encrypted = Crypt::encryptString($plain);
    }

    public function plainToken(): ?string
    {
        if (! filled($this->token_encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString($this->token_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    public function markUsed(): void
    {
        $this->forceFill(['last_used_at' => now()])->save();
    }
}
