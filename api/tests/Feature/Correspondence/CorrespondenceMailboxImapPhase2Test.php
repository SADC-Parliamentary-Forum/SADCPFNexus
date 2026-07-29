<?php

namespace Tests\Feature\Correspondence;

use App\Models\CorrespondenceMailboxSetting;
use App\Models\CorrespondenceMailboxSuggestion;
use App\Models\Tenant;
use App\Modules\Correspondence\Services\CorrespondenceMailboxService;
use Illuminate\Support\Facades\Artisan;
use Tests\TestCase;

class CorrespondenceMailboxImapPhase2Test extends TestCase
{
    private function grantAdmin(Tenant $tenant)
    {
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo([
            'correspondence.view',
            'correspondence.registry',
            'correspondence.admin',
        ]);

        return $admin;
    }

    public function test_imap_settings_can_be_stored_without_live_credentials(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->grantAdmin($tenant);

        $this->asUser($admin)
            ->putJson('/api/v1/correspondence/mailbox/settings', [
                'mailbox_address' => 'registry@sadcpf.org',
                'enabled' => true,
                'imap_host' => 'imap.example.org',
                'imap_port' => 993,
                'imap_encryption' => 'ssl',
                'imap_username' => 'registry@sadcpf.org',
                'notes' => 'Designated registry mailbox only — never all-employee ingest',
            ])
            ->assertOk()
            ->assertJsonPath('data.imap_host', 'imap.example.org')
            ->assertJsonPath('data.imap_port', 993)
            ->assertJsonPath('data.imap_configured', false);

        $this->assertDatabaseHas('correspondence_mailbox_settings', [
            'tenant_id' => $tenant->id,
            'imap_host' => 'imap.example.org',
            'imap_username' => 'registry@sadcpf.org',
        ]);
    }

    public function test_poll_command_fixture_creates_suggestions_only_with_dedupe(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->grantAdmin($tenant);

        CorrespondenceMailboxSetting::create([
            'tenant_id' => $tenant->id,
            'mailbox_address' => 'registry@sadcpf.org',
            'enabled' => true,
            'imap_host' => 'imap.example.org',
            'imap_port' => 993,
            'imap_encryption' => 'ssl',
            'imap_username' => 'registry@sadcpf.org',
            'updated_by' => $admin->id,
        ]);

        $fixture = storage_path('app/testing/mailbox_fixture_'.uniqid().'.json');
        if (! is_dir(dirname($fixture))) {
            mkdir(dirname($fixture), 0777, true);
        }
        file_put_contents($fixture, json_encode([
            [
                'message_id' => '<imap-1@mail.sadcpf.org>',
                'subject' => 'From IMAP fixture',
                'from_address' => 'protocol@example.gov',
                'from_name' => 'Protocol',
                'received_at' => '2026-07-21T10:00:00Z',
                'body_preview' => 'Please register',
            ],
            [
                'message_id' => '<imap-1@mail.sadcpf.org>',
                'subject' => 'Duplicate should skip',
            ],
            [
                'message_id' => '<imap-2@mail.sadcpf.org>',
                'subject' => 'Second message',
                'from_address' => 'a@example.com',
            ],
        ]));

        $exit = Artisan::call('correspondence:poll-mailbox', [
            '--tenant' => $tenant->id,
            '--fixture' => $fixture,
        ]);
        $this->assertSame(0, $exit);

        $this->assertSame(2, CorrespondenceMailboxSuggestion::where('tenant_id', $tenant->id)->count());
        $this->assertDatabaseHas('correspondence_mailbox_suggestions', [
            'tenant_id' => $tenant->id,
            'message_id' => '<imap-1@mail.sadcpf.org>',
            'status' => 'suggested',
        ]);
        $this->assertDatabaseMissing('correspondence', [
            'message_id' => '<imap-1@mail.sadcpf.org>',
        ]);

        @unlink($fixture);
    }

    public function test_dry_run_does_not_persist_suggestions(): void
    {
        $tenant = Tenant::factory()->create();
        $this->grantAdmin($tenant);

        CorrespondenceMailboxSetting::create([
            'tenant_id' => $tenant->id,
            'mailbox_address' => 'registry@sadcpf.org',
            'enabled' => true,
        ]);

        $fixture = storage_path('app/testing/mailbox_dry_'.uniqid().'.json');
        if (! is_dir(dirname($fixture))) {
            mkdir(dirname($fixture), 0777, true);
        }
        file_put_contents($fixture, json_encode([
            ['message_id' => '<dry@mail.example>', 'subject' => 'Dry'],
        ]));

        Artisan::call('correspondence:poll-mailbox', [
            '--tenant' => $tenant->id,
            '--fixture' => $fixture,
            '--dry-run' => true,
        ]);

        $this->assertSame(0, CorrespondenceMailboxSuggestion::where('tenant_id', $tenant->id)->count());
        @unlink($fixture);
    }

    public function test_poll_skipped_when_mailbox_disabled(): void
    {
        $tenant = Tenant::factory()->create();
        CorrespondenceMailboxSetting::create([
            'tenant_id' => $tenant->id,
            'enabled' => false,
            'imap_host' => 'imap.example.org',
        ]);

        $result = app(CorrespondenceMailboxService::class)->pollMailbox((int) $tenant->id, [
            'dry_run' => false,
            'messages' => [
                ['message_id' => '<skip@example>', 'subject' => 'Should not import'],
            ],
        ]);

        $this->assertSame(0, $result['imported']);
        $this->assertSame('disabled', $result['status']);
    }

    public function test_live_poll_degrades_gracefully_when_imap_not_configured(): void
    {
        $tenant = Tenant::factory()->create();
        CorrespondenceMailboxSetting::create([
            'tenant_id' => $tenant->id,
            'mailbox_address' => 'registry@sadcpf.org',
            'enabled' => true,
            'imap_host' => null,
            'imap_username' => null,
        ]);

        $result = app(CorrespondenceMailboxService::class)->pollMailbox((int) $tenant->id, [
            'dry_run' => false,
        ]);

        $this->assertSame('degraded', $result['status']);
        $this->assertSame(0, $result['imported']);
        $this->assertNotEmpty($result['errors']);
        $this->assertSame(0, CorrespondenceMailboxSuggestion::where('tenant_id', $tenant->id)->count());
        $this->assertSame('degraded', CorrespondenceMailboxSetting::where('tenant_id', $tenant->id)->value('last_poll_status'));
    }

    public function test_live_poll_degrades_when_ext_imap_missing_even_with_credentials(): void
    {
        if (function_exists('imap_open')) {
            $this->markTestSkipped('ext-imap is present; degrade path for missing extension is covered in CI without the extension.');
        }

        $tenant = Tenant::factory()->create();
        $settings = CorrespondenceMailboxSetting::create([
            'tenant_id' => $tenant->id,
            'mailbox_address' => 'registry@sadcpf.org',
            'enabled' => true,
            'imap_host' => 'imap.example.org',
            'imap_port' => 993,
            'imap_encryption' => 'ssl',
            'imap_username' => 'registry@sadcpf.org',
        ]);
        $settings->setImapPassword('secret-not-used');
        $settings->save();

        $result = app(CorrespondenceMailboxService::class)->pollMailbox((int) $tenant->id);

        $this->assertSame('degraded', $result['status']);
        $this->assertSame(0, $result['imported']);
        $this->assertTrue(collect($result['errors'])->contains(fn ($e) => str_contains(strtolower($e), 'ext-imap')));
    }
}
