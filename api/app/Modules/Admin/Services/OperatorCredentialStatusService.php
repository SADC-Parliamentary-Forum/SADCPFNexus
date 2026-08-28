<?php

namespace App\Modules\Admin\Services;

use App\Models\CorrespondenceMailboxSetting;
use App\Modules\Admin\Services\MobileStoreSubmitClient;

/**
 * Aggregated operator credential / integration status.
 * Never returns secret values — only booleans, drivers, and setup guidance.
 */
final class OperatorCredentialStatusService
{
    /** @return list<array<string, mixed>> */
    public function status(): array
    {
        return [
            $this->googleCalendar(),
            $this->correspondenceImap(),
            $this->fleetTelematics(),
            $this->weeklyAi(),
            $this->procurementAi(),
            $this->mandeAi(),
            $this->payrollVendor(),
            $this->peopleAuthorityM365(),
            $this->peopleAuthorityEsign(),
            $this->peopleAuthorityCertificate(),
            $this->peopleAuthorityAi(),
            $this->sms(),
            $this->whatsapp(),
            $this->notificationsAi(),
            $this->siem(),
            $this->playStore(),
            $this->appStoreConnect(),
        ];
    }

    /** @return array<string, mixed> */
    private function googleCalendar(): array
    {
        $configured = filled(config('services.google.calendar_client_id'))
            && filled(config('services.google.calendar_client_secret'))
            && (
                filled(config('services.google.calendar_refresh_token'))
                || (filled(config('services.google.calendar_service_account_json'))
                    && is_readable((string) config('services.google.calendar_service_account_json')))
            );

        return [
            'key' => 'google_calendar',
            'label' => 'Google Calendar (Assignments)',
            'configured' => $configured,
            'driver' => $configured ? 'google' : 'ics',
            'secret_source' => 'env',
            'guidance' => 'Set GOOGLE_CALENDAR_CLIENT_ID/SECRET plus REFRESH_TOKEN or SERVICE_ACCOUNT_JSON path on the server.',
            'details' => [
                'webhook_secret_set' => filled(config('services.google.calendar_webhook_secret')),
                'calendar_id' => config('services.google.calendar_id', 'primary'),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function correspondenceImap(): array
    {
        $envPassword = filled(config('correspondence.imap.password'));
        $dbConfigured = CorrespondenceMailboxSetting::query()
            ->get()
            ->contains(fn (CorrespondenceMailboxSetting $row) => (bool) ($row->imap_configured ?? false));

        return [
            'key' => 'correspondence_imap',
            'label' => 'Correspondence IMAP',
            'configured' => $envPassword || $dbConfigured,
            'driver' => 'imap',
            'secret_source' => 'env_or_encrypted_db',
            'guidance' => 'Set CORRESPONDENCE_IMAP_PASSWORD via server env (preferred). Host/user live in Correspondence mailbox settings.',
            'details' => [
                'ext_imap_loaded' => extension_loaded('imap'),
                'env_password_set' => $envPassword,
                'mailbox_row_configured' => $dbConfigured,
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function fleetTelematics(): array
    {
        $driver = (string) config('fleet_telematics.driver', 'null');
        $configured = $driver !== '' && $driver !== 'null' && filled(config('fleet_telematics.api_key'));

        return [
            'key' => 'fleet_telematics',
            'label' => 'Fleet telematics',
            'configured' => $configured || filled(config('fleet_telematics.webhook_token')),
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set FLEET_TELEMATICS_DRIVER/API_KEY and optional WEBHOOK_TOKEN via server env.',
            'details' => [
                'webhook_configured' => filled(config('fleet_telematics.webhook_token')),
                'schedule_enabled' => (bool) config('fleet_telematics.schedule_enabled', false),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function weeklyAi(): array
    {
        $provider = (string) config('weekly_reports.ai_provider', 'stub');
        $configured = $provider === 'llm'
            && filled(config('weekly_reports.ai_llm_endpoint'))
            && filled(config('weekly_reports.ai_llm_api_key'));

        return [
            'key' => 'weekly_ai',
            'label' => 'Weekly reports LLM',
            'configured' => $configured,
            'driver' => $provider,
            'secret_source' => 'env',
            'guidance' => 'Set WEEKLY_AI_PROVIDER=llm plus WEEKLY_AI_LLM_ENDPOINT and WEEKLY_AI_LLM_API_KEY. Never auto-submits.',
            'details' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function procurementAi(): array
    {
        $provider = (string) config('procurement.ai_comparison_provider', 'stub');
        $configured = (bool) config('procurement.ai_comparison_enabled', false)
            && $provider === 'llm'
            && filled(config('procurement.ai_comparison_llm_endpoint'))
            && filled(config('procurement.ai_comparison_llm_api_key'));

        return [
            'key' => 'procurement_ai',
            'label' => 'Procurement comparison LLM',
            'configured' => $configured,
            'driver' => $provider,
            'secret_source' => 'env',
            'guidance' => 'Enable PROCUREMENT_AI_COMPARISON_* env vars. Drafts only — human confirm required.',
            'details' => [
                'enabled_flag' => (bool) config('procurement.ai_comparison_enabled', false),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function mandeAi(): array
    {
        $provider = (string) config('mande_ai.provider', 'stub');
        $configured = $provider === 'llm'
            && filled(config('mande_ai.llm_endpoint'))
            && filled(config('mande_ai.llm_api_key'));

        return [
            'key' => 'mande_ai',
            'label' => 'M&E LLM',
            'configured' => $configured,
            'driver' => $provider,
            'secret_source' => 'env',
            'guidance' => 'Set MANDE_AI_PROVIDER=llm plus endpoint/API key env vars. Never auto-submits.',
            'details' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function payrollVendor(): array
    {
        $driver = (string) config('payroll_vendor.driver', 'null');
        $configured = $driver !== '' && $driver !== 'null' && filled(config('payroll_vendor.api_key'));

        return [
            'key' => 'payroll_vendor',
            'label' => 'Payroll vendor',
            'configured' => $configured,
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set PAYROLL_VENDOR_DRIVER/HTTP_URL/API_KEY via server env. No vendor secrets in the repo.',
            'details' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function peopleAuthorityM365(): array
    {
        $driver = (string) config('people_authority.m365_driver', 'null');
        $configured = in_array($driver, ['microsoft_graph', 'fixture'], true) && (
            ($driver === 'microsoft_graph'
                && filled(config('people_authority.m365_tenant_id'))
                && filled(config('people_authority.m365_client_id'))
                && filled(config('people_authority.m365_client_secret')))
            || ($driver === 'fixture' && filled(config('people_authority.m365_fixture_path')))
        );

        return [
            'key' => 'people_m365',
            'label' => 'Microsoft 365 / directory sync',
            'configured' => $configured,
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set PEOPLE_AUTHORITY_M365_DRIVER=microsoft_graph plus TENANT_ID/CLIENT_ID/CLIENT_SECRET, or DRIVER=fixture with FIXTURE_PATH. Read-only sync; dry-run default.',
            'details' => [
                'dry_run_default' => (bool) config('people_authority.m365_dry_run_default', true),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function peopleAuthorityEsign(): array
    {
        $driver = (string) config('people_authority.esign_driver', 'null');
        $configured = $driver === 'generic_http'
            && filled(config('people_authority.esign_http_url'))
            && filled(config('people_authority.esign_http_token'));

        return [
            'key' => 'people_esign',
            'label' => 'External e-sign provider',
            'configured' => $configured,
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set PEOPLE_AUTHORITY_ESIGN_DRIVER=generic_http plus HTTP_URL/TOKEN. Human-triggered submit only — never auto-starts.',
            'details' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function peopleAuthorityCertificate(): array
    {
        $driver = (string) config('people_authority.certificate_driver', 'stub');
        $configured = $driver === 'pkcs11_http'
            && filled(config('people_authority.certificate_http_url'))
            && filled(config('people_authority.certificate_http_token'));

        return [
            'key' => 'people_certificate',
            'label' => 'Certificate signature driver',
            'configured' => $configured || $driver === 'stub',
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Default stub. For HSM gateway set PEOPLE_AUTHORITY_CERTIFICATE_DRIVER=pkcs11_http plus HTTP_URL/TOKEN. No private keys stored in Nexus.',
            'details' => [
                'stub_default' => $driver === 'stub',
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function peopleAuthorityAi(): array
    {
        $provider = (string) config('people_authority.ai_provider', 'stub');
        $configured = $provider === 'http'
            && filled(config('people_authority.ai_http_url'))
            && filled(config('people_authority.ai_http_token'));

        return [
            'key' => 'people_ai',
            'label' => 'People & Authority AI assist',
            'configured' => $configured,
            'driver' => $provider,
            'secret_source' => 'env',
            'guidance' => 'Set PEOPLE_AUTHORITY_AI_PROVIDER=http plus HTTP_URL/TOKEN. Suggestions only — never auto-grants access/authority/delegation/signing/privileged roles.',
            'details' => [
                'enabled' => (bool) config('people_authority.ai_enabled', true),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function sms(): array
    {
        $driver = (string) config('notifications.sms_provider', 'null');
        $configured = $driver === 'http' && filled(config('notifications.sms_http_url'));

        return [
            'key' => 'sms',
            'label' => 'SMS delivery',
            'configured' => $configured,
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set NOTIFICATIONS_SMS_PROVIDER=http plus NOTIFICATIONS_SMS_HTTP_URL and optional TOKEN. Default remains Null. Approve /admin/notifications/governance first.',
            'details' => [
                'url_set' => filled(config('notifications.sms_http_url')),
                'token_set' => filled(config('notifications.sms_http_token')),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function whatsapp(): array
    {
        $driver = (string) config('notifications.whatsapp_provider', 'null');
        $configured = $driver === 'http' && filled(config('notifications.whatsapp_http_url'));

        return [
            'key' => 'whatsapp',
            'label' => 'WhatsApp delivery',
            'configured' => $configured,
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set NOTIFICATIONS_WHATSAPP_PROVIDER=http plus NOTIFICATIONS_WHATSAPP_HTTP_URL and optional TOKEN. Default remains Null. Approve /admin/notifications/governance first.',
            'details' => [
                'url_set' => filled(config('notifications.whatsapp_http_url')),
                'token_set' => filled(config('notifications.whatsapp_http_token')),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function notificationsAi(): array
    {
        $provider = (string) config('notifications.ai_provider', 'stub');
        $configured = $provider === 'http'
            && filled(config('notifications.ai_http_url'));

        return [
            'key' => 'notifications_ai',
            'label' => 'Notifications LLM assist',
            'configured' => $configured,
            'driver' => $provider,
            'secret_source' => 'env',
            'guidance' => 'Set NOTIFICATIONS_AI_PROVIDER=http plus NOTIFICATIONS_AI_HTTP_URL/TOKEN. Digest summaries only — never auto-sends or auto-applies.',
            'details' => [
                'enabled' => (bool) config('notifications.ai_enabled', true),
                'url_set' => filled(config('notifications.ai_http_url')),
                'token_set' => filled(config('notifications.ai_http_token')),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function siem(): array
    {
        $driver = (string) config('audit.siem_driver', 'null');
        $configured = $driver === 'http' && filled(config('audit.siem_http_url'));

        return [
            'key' => 'siem',
            'label' => 'SIEM webhook',
            'configured' => $configured,
            'driver' => $driver,
            'secret_source' => 'env',
            'guidance' => 'Set AUDIT_SIEM_DRIVER=http plus AUDIT_SIEM_HTTP_URL and optional TOKEN. Approve /admin/audit-trail/governance SIEM first. Local ingest is never rolled back on sink failure.',
            'details' => [
                'url_set' => filled(config('audit.siem_http_url')),
                'token_set' => filled(config('audit.siem_http_token')),
            ],
        ];
    }

    /** @return array<string, mixed> */
    private function playStore(): array
    {
        $play = app(MobileStoreSubmitClient::class)->playStatus();
        $configured = $play['configured'];

        return [
            'key' => 'play_store',
            'label' => 'Google Play Console',
            'configured' => $configured,
            'driver' => $play['driver'] ?? ($configured ? 'service_account' : null),
            'secret_source' => 'env',
            'guidance' => 'Set PLAY_STORE_HTTP_URL or PLAY_STORE_SERVICE_ACCOUNT_JSON via server env. Secrets never appear in Admin UI. Artisan: php artisan mobile:submit-store play',
            'details' => [],
        ];
    }

    /** @return array<string, mixed> */
    private function appStoreConnect(): array
    {
        $asc = app(MobileStoreSubmitClient::class)->appStoreStatus();
        $configured = $asc['configured'];

        return [
            'key' => 'app_store_connect',
            'label' => 'App Store Connect (ASC)',
            'configured' => $configured,
            'driver' => $asc['driver'] ?? ($configured ? 'asc_api' : null),
            'secret_source' => 'env',
            'guidance' => 'Set ASC_HTTP_URL or ASC_KEY_ID / ASC_ISSUER_ID / ASC_PRIVATE_KEY_PATH via server env. Never commit keys. Artisan: php artisan mobile:submit-store appstore',
            'details' => [],
        ];
    }
}
