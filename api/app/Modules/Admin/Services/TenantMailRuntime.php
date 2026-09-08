<?php

namespace App\Modules\Admin\Services;

use App\Models\TenantMailSetting;

/**
 * Applies Admin-saved SMTP onto the Laravel mailer for the current tenant.
 * Env MAIL_* remains the fallback when Admin SMTP is incomplete.
 */
final class TenantMailRuntime
{
    public function apply(?int $tenantId): void
    {
        if (! $tenantId) {
            return;
        }
        $row = TenantMailSetting::query()->where('tenant_id', $tenantId)->first();
        if (! $row || ! $row->smtpConfigured()) {
            return;
        }
        $encryption = strtolower((string) ($row->smtp_encryption ?: 'tls'));
        config([
            'mail.default' => 'smtp',
            'mail.mailers.smtp.transport' => 'smtp',
            'mail.mailers.smtp.host' => $row->smtp_host,
            'mail.mailers.smtp.port' => (int) ($row->smtp_port ?: 587),
            'mail.mailers.smtp.username' => $row->smtp_username,
            'mail.mailers.smtp.password' => $row->resolveSmtpPassword(),
            'mail.mailers.smtp.encryption' => $encryption === 'none' ? null : $encryption,
            'mail.from.address' => $row->smtp_from_address ?: $row->smtp_username,
            'mail.from.name' => $row->smtp_from_name ?: config('mail.from.name'),
        ]);
    }
}
