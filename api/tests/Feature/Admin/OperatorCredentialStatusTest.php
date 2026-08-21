<?php

namespace Tests\Feature\Admin;

use App\Models\Tenant;
use App\Modules\Admin\Services\OperatorCredentialStatusService;
use Tests\TestCase;

class OperatorCredentialStatusTest extends TestCase
{
    public function test_status_service_lists_integrations_without_secrets(): void
    {
        config([
            'services.google.calendar_client_id' => null,
            'services.google.calendar_client_secret' => null,
            'correspondence.imap.password' => null,
            'fleet_telematics.driver' => 'null',
            'fleet_telematics.api_key' => null,
            'weekly_reports.ai_provider' => 'stub',
            'weekly_reports.ai_llm_api_key' => null,
            'procurement.ai_comparison_provider' => 'stub',
            'procurement.ai_comparison_llm_api_key' => null,
            'mande_ai.provider' => 'stub',
            'mande_ai.llm_api_key' => null,
            'payroll_vendor.driver' => 'null',
            'payroll_vendor.api_key' => null,
            'notifications.sms_provider' => 'null',
            'notifications.sms_http_url' => null,
            'notifications.sms_http_token' => null,
            'notifications.whatsapp_provider' => 'null',
            'notifications.whatsapp_http_url' => null,
            'notifications.whatsapp_http_token' => null,
            'notifications.ai_provider' => 'stub',
            'notifications.ai_http_url' => null,
            'notifications.ai_http_token' => null,
            'audit.siem_driver' => 'null',
            'audit.siem_http_url' => null,
            'audit.siem_http_token' => null,
        ]);

        $items = app(OperatorCredentialStatusService::class)->status();
        $keys = collect($items)->pluck('key')->all();

        $this->assertContains('google_calendar', $keys);
        $this->assertContains('correspondence_imap', $keys);
        $this->assertContains('fleet_telematics', $keys);
        $this->assertContains('weekly_ai', $keys);
        $this->assertContains('procurement_ai', $keys);
        $this->assertContains('mande_ai', $keys);
        $this->assertContains('payroll_vendor', $keys);
        $this->assertContains('people_m365', $keys);
        $this->assertContains('people_esign', $keys);
        $this->assertContains('people_certificate', $keys);
        $this->assertContains('people_ai', $keys);
        $this->assertContains('play_store', $keys);
        $this->assertContains('app_store_connect', $keys);
        $this->assertContains('sms', $keys);
        $this->assertContains('whatsapp', $keys);
        $this->assertContains('notifications_ai', $keys);
        $this->assertContains('siem', $keys);

        $sms = collect($items)->firstWhere('key', 'sms');
        $this->assertFalse($sms['configured']);
        $this->assertSame('null', $sms['driver']);

        foreach ($items as $item) {
            $this->assertArrayHasKey('configured', $item);
            $this->assertArrayHasKey('secret_source', $item);
            $encoded = json_encode($item);
            $this->assertStringNotContainsString('csecret', (string) $encoded);
            $this->assertStringNotContainsString('api_key_value', (string) $encoded);
        }
    }

    public function test_admin_endpoint_returns_credential_status(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/admin/operator-credentials')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    ['key', 'label', 'configured', 'driver', 'secret_source', 'guidance'],
                ],
            ]);
    }

    public function test_non_admin_cannot_view_operator_credentials(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/admin/operator-credentials')->assertForbidden();
    }

    public function test_imap_reports_ext_imap_availability(): void
    {
        $status = collect(app(OperatorCredentialStatusService::class)->status())
            ->firstWhere('key', 'correspondence_imap');

        $this->assertIsArray($status);
        $this->assertArrayHasKey('ext_imap_loaded', $status['details']);
        $this->assertSame(extension_loaded('imap'), $status['details']['ext_imap_loaded']);
    }
}
