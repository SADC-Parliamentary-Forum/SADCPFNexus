<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class GoogleCalendarConnection extends Model
{
    protected $fillable = [
        'tenant_id',
        'user_id',
        'calendar_id',
        'refresh_token_encrypted',
        'access_token_encrypted',
        'token_expires_at',
        'sync_token',
        'channel_id',
        'resource_id',
        'last_synced_at',
    ];

    protected $hidden = [
        'refresh_token_encrypted',
        'access_token_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'token_expires_at' => 'datetime',
            'last_synced_at' => 'datetime',
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

    public function setRefreshToken(?string $plain): void
    {
        $this->refresh_token_encrypted = filled($plain) ? Crypt::encryptString($plain) : null;
    }

    public function getRefreshToken(): ?string
    {
        if (! filled($this->refresh_token_encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString($this->refresh_token_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }

    public function setAccessToken(?string $plain): void
    {
        $this->access_token_encrypted = filled($plain) ? Crypt::encryptString($plain) : null;
    }

    public function getAccessToken(): ?string
    {
        if (! filled($this->access_token_encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString($this->access_token_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }
}
