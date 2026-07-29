<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\CorrespondenceMailboxSuggestion;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class CorrespondenceMailboxPhase2Test extends TestCase
{
    private function grantRegistry(User $user): void
    {
        $user->givePermissionTo([
            'correspondence.view',
            'correspondence.create',
            'correspondence.registry',
            'correspondence.route',
            'correspondence.approve',
            'correspondence.send',
            'correspondence.dispatch',
            'correspondence.review',
            'correspondence.confidential.view',
        ]);
    }

    public function test_paste_email_headers_creates_suggestion_with_message_id(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $this->grantRegistry($admin);

        $this->asUser($admin)
            ->putJson('/api/v1/correspondence/mailbox/settings', [
                'mailbox_address' => 'registry@sadcpf.org',
                'enabled' => true,
                'notes' => 'Designated registry mailbox only',
            ])
            ->assertOk()
            ->assertJsonPath('data.mailbox_address', 'registry@sadcpf.org');

        $created = $this->asUser($admin)
            ->postJson('/api/v1/correspondence/mailbox/suggestions/import', [
                'message_id' => '<abc123@mail.sadcpf.org>',
                'subject' => 'Official note from Member State',
                'from_address' => 'protocol@example.gov',
                'from_name' => 'Protocol Office',
                'received_at' => '2026-07-20T09:00:00Z',
                'body_preview' => 'Please find attached...',
                'raw_headers' => "Message-ID: <abc123@mail.sadcpf.org>\nSubject: Official note",
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('<abc123@mail.sadcpf.org>', $created['message_id']);
        $this->assertSame('suggested', $created['status']);
        $this->assertDatabaseHas('correspondence_mailbox_suggestions', [
            'tenant_id' => $tenant->id,
            'message_id' => '<abc123@mail.sadcpf.org>',
        ]);
    }

    public function test_duplicate_message_id_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $this->grantRegistry($admin);

        CorrespondenceMailboxSuggestion::create([
            'tenant_id' => $tenant->id,
            'message_id' => '<dup@mail.example>',
            'subject' => 'First',
            'from_address' => 'a@example.com',
            'status' => 'suggested',
        ]);

        $this->asUser($admin)
            ->postJson('/api/v1/correspondence/mailbox/suggestions/import', [
                'message_id' => '<dup@mail.example>',
                'subject' => 'Second attempt',
                'from_address' => 'b@example.com',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['message_id']);
    }

    public function test_register_from_suggestion_persists_message_id_and_blocks_reuse(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $this->grantRegistry($admin);

        $suggestion = CorrespondenceMailboxSuggestion::create([
            'tenant_id' => $tenant->id,
            'message_id' => '<reg@mail.example>',
            'subject' => 'Register me',
            'from_address' => 'sender@example.com',
            'from_name' => 'Sender',
            'received_at' => now(),
            'body_preview' => 'Body',
            'status' => 'suggested',
        ]);

        $letter = $this->asUser($admin)
            ->postJson("/api/v1/correspondence/mailbox/suggestions/{$suggestion->id}/register", [
                'channel' => 'email',
                'sender_organisation' => 'Example Org',
                'summary' => 'Imported from registry mailbox suggestion',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('<reg@mail.example>', $letter['message_id'] ?? Correspondence::find($letter['id'])->message_id);
        $this->assertSame('imported', $suggestion->fresh()->status);

        $this->asUser($admin)
            ->postJson('/api/v1/correspondence/mailbox/suggestions/import', [
                'message_id' => '<reg@mail.example>',
                'subject' => 'Should fail',
                'from_address' => 'x@example.com',
            ])
            ->assertStatus(422);
    }
}
