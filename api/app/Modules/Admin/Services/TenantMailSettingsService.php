<?php

namespace App\Modules\Admin\Services;

use App\Models\AuditLog;
use App\Models\CorrespondenceMailboxSetting;
use App\Models\TenantMailSetting;
use App\Models\User;
use App\Modules\Correspondence\Services\CorrespondenceMailboxService;

class TenantMailSettingsService
{
    public function __construct(
        private readonly CorrespondenceMailboxService $correspondenceMailbox,
    ) {}

    /**
     * @return array<string, mixed>
     */
    public function show(int $tenantId): array
    {
        $mail = TenantMailSetting::forTenant($tenantId);
        $registry = $this->correspondenceMailbox->getSettings($tenantId);

        return [
            'smtp' => $this->smtpPayload($mail),
            'correspondence_imap' => $this->correspondencePayload($registry),
            'procurement_imap' => $this->procurementPayload($mail),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array<string, mixed>
     */
    public function update(int $tenantId, User $actor, array $data): array
    {
        $mail = TenantMailSetting::forTenant($tenantId);
        $mail->updated_by = $actor->id;

        if (isset($data['smtp']) && is_array($data['smtp'])) {
            $smtp = $data['smtp'];
            if (array_key_exists('enabled', $smtp)) {
                $mail->smtp_enabled = (bool) $smtp['enabled'];
            }
            foreach (['host' => 'smtp_host', 'username' => 'smtp_username', 'from_address' => 'smtp_from_address', 'from_name' => 'smtp_from_name'] as $in => $col) {
                if (array_key_exists($in, $smtp)) {
                    $mail->{$col} = $this->nullableString($smtp[$in]);
                }
            }
            if (array_key_exists('port', $smtp)) {
                $mail->smtp_port = $smtp['port'] !== null && $smtp['port'] !== '' ? (int) $smtp['port'] : null;
            }
            if (array_key_exists('encryption', $smtp)) {
                $mail->smtp_encryption = $this->nullableString($smtp['encryption']);
            }
            if (! empty($smtp['password'])) {
                $mail->setSmtpPassword((string) $smtp['password']);
            }
        }

        if (isset($data['procurement_imap']) && is_array($data['procurement_imap'])) {
            $imap = $data['procurement_imap'];
            if (array_key_exists('enabled', $imap)) {
                $mail->procurement_imap_enabled = (bool) $imap['enabled'];
            }
            foreach ([
                'mailbox_address' => 'procurement_mailbox_address',
                'host' => 'procurement_imap_host',
                'username' => 'procurement_imap_username',
                'allowlist' => 'procurement_imap_allowlist',
            ] as $in => $col) {
                if (array_key_exists($in, $imap)) {
                    $mail->{$col} = $this->nullableString($imap[$in]);
                }
            }
            if (array_key_exists('port', $imap)) {
                $mail->procurement_imap_port = $imap['port'] !== null && $imap['port'] !== '' ? (int) $imap['port'] : null;
            }
            if (array_key_exists('encryption', $imap)) {
                $mail->procurement_imap_encryption = $this->nullableString($imap['encryption']);
            }
            if (! empty($imap['password'])) {
                $mail->setProcurementImapPassword((string) $imap['password']);
            }
        }

        $mail->save();

        if (isset($data['correspondence_imap']) && is_array($data['correspondence_imap'])) {
            $imap = $data['correspondence_imap'];
            $this->correspondenceMailbox->updateSettings($tenantId, [
                'enabled' => $imap['enabled'] ?? true,
                'mailbox_address' => $imap['mailbox_address'] ?? null,
                'imap_host' => $imap['host'] ?? null,
                'imap_port' => $imap['port'] ?? 993,
                'imap_encryption' => $imap['encryption'] ?? 'ssl',
                'imap_username' => $imap['username'] ?? null,
                'notes' => $imap['notes'] ?? null,
                ...(isset($imap['password']) && filled($imap['password']) ? ['imap_password' => $imap['password']] : []),
            ], $actor);
        }

        AuditLog::record('admin.email_settings_updated', [
            'auditable_type' => TenantMailSetting::class,
            'auditable_id' => $mail->id,
            'user_id' => $actor->id,
            'tenant_id' => $tenantId,
            'new_values' => [
                'smtp_configured' => $mail->fresh()?->smtpConfigured(),
                'procurement_imap_configured' => $mail->fresh()?->procurementImapConfiguredFromDb(),
            ],
            'tags' => 'admin,email',
        ]);

        return $this->show($tenantId);
    }

    /**
     * @return array<string, mixed>
     */
    private function smtpPayload(TenantMailSetting $mail): array
    {
        return [
            'enabled' => (bool) $mail->smtp_enabled,
            'configured' => $mail->smtpConfigured(),
            'host' => $mail->smtp_host,
            'port' => $mail->smtp_port ?: 587,
            'encryption' => $mail->smtp_encryption ?: 'tls',
            'username' => $mail->smtp_username,
            'from_address' => $mail->smtp_from_address,
            'from_name' => $mail->smtp_from_name,
            'has_password' => filled($mail->smtp_password_encrypted),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function correspondencePayload(CorrespondenceMailboxSetting $row): array
    {
        return [
            'enabled' => (bool) $row->enabled,
            'configured' => (bool) $row->imap_configured,
            'mailbox_address' => $row->mailbox_address,
            'host' => $row->imap_host,
            'port' => $row->imap_port ?: 993,
            'encryption' => $row->imap_encryption ?: 'ssl',
            'username' => $row->imap_username,
            'has_password' => (bool) $row->has_imap_password,
            'notes' => $row->notes,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function procurementPayload(TenantMailSetting $mail): array
    {
        $resolved = TenantMailSetting::resolvedProcurementImap((int) $mail->tenant_id);

        return [
            'enabled' => (bool) $mail->procurement_imap_enabled,
            'configured' => $mail->procurementImapConfiguredFromDb()
                || (trim((string) $resolved['host']) !== '' && trim((string) $resolved['user']) !== '' && (string) $resolved['password'] !== ''),
            'mailbox_address' => $mail->procurement_mailbox_address,
            'host' => $mail->procurement_imap_host,
            'port' => $mail->procurement_imap_port ?: 993,
            'encryption' => $mail->procurement_imap_encryption ?: 'ssl',
            'username' => $mail->procurement_imap_username,
            'allowlist' => $mail->procurement_imap_allowlist,
            'has_password' => filled($mail->procurement_imap_password_encrypted) || filled(config('procurement.inbox_imap_password')),
        ];
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }
        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }
}
