<?php

namespace Tests\Feature\Admin;

use App\Models\Tenant;
use App\Models\TenantMailSetting;
use App\Modules\Procurement\Support\Ocr\OcrEngine;
use App\Modules\Procurement\Support\ProcurementInboxFactory;
use Tests\Support\FakeOcrEngine;
use Tests\Support\InvoicePdfFixture;
use Tests\TestCase;

class AdminEmailSettingsTest extends TestCase
{
    public function test_staff_cannot_read_or_update_email_settings(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/admin/email')->assertForbidden();
        $http->putJson('/api/v1/admin/email', [
            'smtp' => [
                'host' => 'smtp.example.test',
                'username' => 'alerts@sadcpf.org',
                'password' => 'secret',
            ],
        ])->assertForbidden();
    }

    public function test_admin_can_save_outgoing_smtp_without_echoing_password(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/admin/email')
            ->assertOk()
            ->assertJsonPath('data.smtp.configured', false)
            ->assertJsonMissingPath('data.smtp.password')
            ->assertJsonMissingPath('data.procurement_imap.password');

        $http->putJson('/api/v1/admin/email', [
            'smtp' => [
                'enabled' => true,
                'host' => 'smtp.example.test',
                'port' => 587,
                'encryption' => 'tls',
                'username' => 'alerts@sadcpf.org',
                'password' => 'smtp-secret',
                'from_address' => 'alerts@sadcpf.org',
                'from_name' => 'SADC-PF Nexus',
            ],
        ])->assertOk()
            ->assertJsonPath('data.smtp.configured', true)
            ->assertJsonPath('data.smtp.host', 'smtp.example.test')
            ->assertJsonPath('data.smtp.has_password', true)
            ->assertJsonMissingPath('data.smtp.password');

        $this->assertDatabaseHas('tenant_mail_settings', [
            'tenant_id' => $tenant->id,
            'smtp_host' => 'smtp.example.test',
            'smtp_username' => 'alerts@sadcpf.org',
        ]);
        $row = TenantMailSetting::query()->where('tenant_id', $tenant->id)->first();
        $this->assertNotNull($row);
        $this->assertNotSame('smtp-secret', (string) $row->smtp_password_encrypted);
        $this->assertSame('smtp-secret', $row->resolveSmtpPassword());

        app(\App\Modules\Admin\Services\TenantMailRuntime::class)->apply((int) $tenant->id);
        $this->assertSame('smtp', config('mail.default'));
        $this->assertSame('smtp.example.test', config('mail.mailers.smtp.host'));
        $this->assertSame('smtp-secret', config('mail.mailers.smtp.password'));
        $this->assertSame('alerts@sadcpf.org', config('mail.from.address'));
    }

    public function test_admin_can_save_incoming_procurement_and_correspondence_mailboxes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->putJson('/api/v1/admin/email', [
            'correspondence_imap' => [
                'enabled' => true,
                'mailbox_address' => 'registry@sadcpf.org',
                'host' => 'imap.example.test',
                'port' => 993,
                'encryption' => 'ssl',
                'username' => 'registry@sadcpf.org',
                'password' => 'registry-secret',
            ],
            'procurement_imap' => [
                'enabled' => true,
                'mailbox_address' => 'invoices@sadcpf.org',
                'host' => 'imap.example.test',
                'port' => 993,
                'encryption' => 'ssl',
                'username' => 'invoices@sadcpf.org',
                'password' => 'invoice-secret',
                'allowlist' => 'trusted@example.test',
            ],
        ])->assertOk()
            ->assertJsonPath('data.correspondence_imap.configured', true)
            ->assertJsonPath('data.correspondence_imap.mailbox_address', 'registry@sadcpf.org')
            ->assertJsonPath('data.procurement_imap.configured', true)
            ->assertJsonPath('data.procurement_imap.mailbox_address', 'invoices@sadcpf.org')
            ->assertJsonMissingPath('data.correspondence_imap.password')
            ->assertJsonMissingPath('data.procurement_imap.password');

        config([
            'procurement.inbox_imap_host' => null,
            'procurement.inbox_imap_user' => null,
            'procurement.inbox_imap_password' => null,
        ]);
        $adapter = app(ProcurementInboxFactory::class)->make((int) $tenant->id);
        $this->assertTrue($adapter->isConfigured());
        $this->assertSame('php_imap', $adapter->adapterName());

        [$officerHttp] = $this->asProcurementOfficer($tenant);
        $officerHttp->getJson('/api/v1/procurement/inbox')
            ->assertOk()
            ->assertJsonPath('imap_configured', true);
    }

    public function test_procurement_imap_host_only_from_admin_stays_unconfigured(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->putJson('/api/v1/admin/email', [
            'procurement_imap' => [
                'enabled' => true,
                'host' => 'imap.example.test',
            ],
        ])->assertOk()
            ->assertJsonPath('data.procurement_imap.configured', false);

        $adapter = app(ProcurementInboxFactory::class)->make((int) $tenant->id);
        $this->assertFalse($adapter->isConfigured());
    }

    public function test_blank_password_keeps_existing_secret(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->putJson('/api/v1/admin/email', [
            'smtp' => [
                'host' => 'smtp.example.test',
                'username' => 'alerts@sadcpf.org',
                'password' => 'keep-me',
                'from_address' => 'alerts@sadcpf.org',
            ],
        ])->assertOk();

        $http->putJson('/api/v1/admin/email', [
            'smtp' => [
                'host' => 'smtp.example.test',
                'username' => 'alerts@sadcpf.org',
                'from_address' => 'noreply@sadcpf.org',
            ],
        ])->assertOk()
            ->assertJsonPath('data.smtp.from_address', 'noreply@sadcpf.org')
            ->assertJsonPath('data.smtp.has_password', true);

        $row = TenantMailSetting::query()->where('tenant_id', $tenant->id)->first();
        $this->assertSame('keep-me', $row?->resolveSmtpPassword());
    }

    public function test_admin_saved_procurement_mailbox_is_used_by_fixture_poll(): void
    {
        $this->app->bind(OcrEngine::class, fn () => new FakeOcrEngine(InvoicePdfFixture::inv0001LiveText()));
        $tenant = Tenant::factory()->create();
        $this->asProcurementOfficer($tenant);
        [$adminHttp] = $this->asAdmin($tenant);

        $adminHttp->putJson('/api/v1/admin/email', [
            'procurement_imap' => [
                'enabled' => true,
                'mailbox_address' => 'invoices@sadcpf.org',
                'host' => 'imap.example.test',
                'username' => 'invoices@sadcpf.org',
                'password' => 'invoice-secret',
            ],
        ])->assertOk();

        $fixture = sys_get_temp_dir().'/admin-email-inbox-'.uniqid().'.json';
        file_put_contents($fixture, json_encode([[
            'message_id' => '<admin-email-inv@example.test>',
            'from_email' => 'jvj@example.test',
            'subject' => 'Invoice',
            'attachments' => [[
                'filename' => 'Invoice_INV0001.pdf',
                'mime' => 'application/pdf',
                'base64' => base64_encode(InvoicePdfFixture::inv0001Pdf()),
            ]],
        ]]));

        $this->assertSame(0, \Illuminate\Support\Facades\Artisan::call('procurement:poll-inbox', [
            '--tenant' => $tenant->id,
            '--fixture' => $fixture,
        ]));
        $this->assertDatabaseHas('procurement_inbox_messages', [
            'tenant_id' => $tenant->id,
            'message_id' => '<admin-email-inv@example.test>',
            'status' => 'extracted',
        ]);
        @unlink($fixture);
    }
}
