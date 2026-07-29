<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class CorrespondenceMailboxSetting extends Model
{
    protected $fillable = [
        'tenant_id',
        'mailbox_address',
        'enabled',
        'notes',
        'updated_by',
        'imap_host',
        'imap_port',
        'imap_encryption',
        'imap_username',
        'imap_password_encrypted',
        'last_polled_at',
        'last_poll_status',
    ];

    protected $hidden = [
        'imap_password_encrypted',
    ];

    protected $appends = [
        'imap_configured',
        'has_imap_password',
    ];

    protected function casts(): array
    {
        return [
            'enabled' => 'boolean',
            'imap_port' => 'integer',
            'last_polled_at' => 'datetime',
        ];
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    protected function imapConfigured(): Attribute
    {
        return Attribute::get(function () {
            $password = config('correspondence.imap.password')
                ?: $this->decryptStoredPassword();

            return filled($this->imap_host)
                && filled($this->imap_username)
                && filled($password)
                && (bool) $this->enabled;
        });
    }

    protected function hasImapPassword(): Attribute
    {
        return Attribute::get(function () {
            return filled(config('correspondence.imap.password')) || filled($this->imap_password_encrypted);
        });
    }

    public function resolveImapPassword(): ?string
    {
        $env = config('correspondence.imap.password');
        if (filled($env)) {
            return (string) $env;
        }

        return $this->decryptStoredPassword();
    }

    public function setImapPassword(?string $plain): void
    {
        $this->imap_password_encrypted = filled($plain) ? Crypt::encryptString($plain) : null;
    }

    private function decryptStoredPassword(): ?string
    {
        if (! filled($this->imap_password_encrypted)) {
            return null;
        }

        try {
            return Crypt::decryptString($this->imap_password_encrypted);
        } catch (\Throwable) {
            return null;
        }
    }
}
