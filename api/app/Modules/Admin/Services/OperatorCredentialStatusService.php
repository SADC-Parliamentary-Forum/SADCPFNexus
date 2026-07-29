<?php

namespace App\Modules\Admin\Services;

use App\Models\CorrespondenceMailboxSetting;

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
}
