<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Crypt;

class TenantMailSetting extends Model
{
    protected $fillable = [
        'tenant_id',
        'smtp_enabled',
        'smtp_host',
        'smtp_port',
        'smtp_encryption',
        'smtp_username',
        'smtp_password_encrypted',
        'smtp_from_address',
        'smtp_from_name',
        'procurement_imap_enabled',
        'procurement_mailbox_address',
        'procurement_imap_host',
        'procurement_imap_port',
        'procurement_imap_encryption',
        'procurement_imap_username',
        'procurement_imap_password_encrypted',
        'procurement_imap_mailbox',
        'procurement_imap_allowlist',
        'updated_by',
    ];

    protected $hidden = [
        'smtp_password_encrypted',
        'procurement_imap_password_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'smtp_enabled' => 'boolean',
            'smtp_port' => 'integer',
            'procurement_imap_enabled' => 'boolean',
            'procurement_imap_port' => 'integer',
        ];
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public static function forTenant(int $tenantId): self
    {
        return static::firstOrCreate(
            ['tenant_id' => $tenantId],
            ['smtp_enabled' => true, 'procurement_imap_enabled' => true]
        );
    }

    public function smtpConfigured(): bool
    {
        return (bool) $this->smtp_enabled
            && filled($this->smtp_host)
            && filled($this->smtp_username)
            && filled($this->resolveSmtpPassword());
    }

    public function procurementImapConfiguredFromDb(): bool
    {
        return (bool) $this->procurement_imap_enabled
            && filled($this->procurement_imap_host)
            && filled($this->procurement_imap_username)
            && filled($this->resolveProcurementImapPassword());
    }

    public function resolveSmtpPassword(): ?string
    {
        return $this->decrypt($this->smtp_password_encrypted);
    }

    public function resolveProcurementImapPassword(): ?string
    {
        return $this->decrypt($this->procurement_imap_password_encrypted);
    }

    public function setSmtpPassword(?string $plain): void
    {
        if ($plain === null || $plain === '') {
            return;
        }
        $this->smtp_password_encrypted = Crypt::encryptString($plain);
    }

    public function setProcurementImapPassword(?string $plain): void
    {
        if ($plain === null || $plain === '') {
            return;
        }
        $this->procurement_imap_password_encrypted = Crypt::encryptString($plain);
    }

    /**
     * Prefer a complete Admin DB mailbox; otherwise fall back to env config.
     * Host alone is never enough.
     *
     * @return array{host: string, user: string, password: string, port: int, encryption: string, mailbox: string, allowlist: mixed, enabled: bool}
     */
    public static function resolvedProcurementImap(?int $tenantId): array
    {
        $env = [
            'host' => trim((string) config('procurement.inbox_imap_host')),
            'user' => trim((string) config('procurement.inbox_imap_user')),
            'password' => (string) config('procurement.inbox_imap_password'),
            'port' => (int) config('procurement.inbox_imap_port', 993),
            'encryption' => (string) config('procurement.inbox_imap_encryption', 'ssl'),
            'mailbox' => (string) config('procurement.inbox_imap_mailbox', 'INBOX'),
            'allowlist' => config('procurement.inbox_imap_allowlist'),
            'enabled' => true,
        ];
        if (! $tenantId) {
            return $env;
        }
        $row = static::query()->where('tenant_id', $tenantId)->first();
        if ($row && $row->procurementImapConfiguredFromDb()) {
            return [
                'host' => trim((string) $row->procurement_imap_host),
                'user' => trim((string) $row->procurement_imap_username),
                'password' => (string) $row->resolveProcurementImapPassword(),
                'port' => (int) ($row->procurement_imap_port ?: 993),
                'encryption' => (string) ($row->procurement_imap_encryption ?: 'ssl'),
                'mailbox' => (string) ($row->procurement_imap_mailbox ?: 'INBOX'),
                'allowlist' => $row->procurement_imap_allowlist,
                'enabled' => true,
            ];
        }

        return $env;
    }

    private function decrypt(?string $value): ?string
    {
        if (! filled($value)) {
            return null;
        }
        try {
            return Crypt::decryptString($value);
        } catch (\Throwable) {
            return null;
        }
    }
}
