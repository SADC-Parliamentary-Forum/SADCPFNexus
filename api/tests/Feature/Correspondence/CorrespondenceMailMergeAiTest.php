<?php

namespace Tests\Feature\Correspondence;

use App\Models\Correspondence;
use App\Models\CorrespondenceLetterTemplate;
use App\Models\Tenant;
use Tests\TestCase;

class CorrespondenceMailMergeAiTest extends TestCase
{
    public function test_mail_merge_substitutes_template_fields_into_letter_draft(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeAdmin($tenant);

        $template = CorrespondenceLetterTemplate::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'name' => 'Acknowledgement',
            'code' => 'ACK-01',
            'subject_template' => 'Acknowledgement — {{subject_matter}}',
            'body_template' => "Dear {{recipient_name}},\n\nWe acknowledge receipt of {{subject_matter}} dated {{letter_date}}.\n\nYours sincerely,\n{{signatory_name}}",
            'is_active' => true,
        ]);

        $merged = $this->asUser($user)
            ->postJson('/api/v1/correspondence/mail-merge/preview', [
                'template_id' => $template->id,
                'fields' => [
                    'recipient_name' => 'Hon. Chairperson',
                    'subject_matter' => 'Climate resolution',
                    'letter_date' => '2026-07-29',
                    'signatory_name' => 'Secretary General',
                ],
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('Acknowledgement — Climate resolution', $merged['subject']);
        $this->assertStringContainsString('Dear Hon. Chairperson', $merged['body']);
        $this->assertStringContainsString('Climate resolution dated 2026-07-29', $merged['body']);
        $this->assertStringNotContainsString('{{', $merged['body']);

        $created = $this->asUser($user)
            ->postJson('/api/v1/correspondence/mail-merge/create', [
                'template_id' => $template->id,
                'fields' => [
                    'recipient_name' => 'Hon. Chairperson',
                    'subject_matter' => 'Climate resolution',
                    'letter_date' => '2026-07-29',
                    'signatory_name' => 'Secretary General',
                ],
                'type' => 'external',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('draft', $created['status']);
        $this->assertStringContainsString('Climate resolution', $created['subject']);
        $this->assertNull($created['sent_at'] ?? null);
    }

    public function test_ai_assist_draft_requires_human_confirm_and_never_auto_sends(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeAdmin($tenant);

        $letter = Correspondence::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'title' => 'Draft note',
            'subject' => 'Draft note',
            'body' => '',
            'type' => 'external',
            'status' => 'draft',
            'direction' => 'outgoing',
            'priority' => 'normal',
        ]);

        $draft = $this->asUser($user)
            ->postJson("/api/v1/correspondence/letters/{$letter->id}/ai-assist", [
                'intent' => 'Acknowledge receipt and propose a courtesy reply.',
            ])
            ->assertOk()
            ->json('data');

        $this->assertTrue($draft['requires_human_confirm']);
        $this->assertFalse($draft['auto_submit']);
        $this->assertFalse($draft['auto_send']);
        $this->assertNotEmpty($draft['draft_subject']);
        $this->assertNotEmpty($draft['draft_body']);

        $letter->refresh();
        $this->assertNotNull($letter->ai_draft_body);
        $this->assertNull($letter->ai_draft_confirmed_at);
        $this->assertSame('draft', $letter->status);
        $this->assertNull($letter->sent_at);

        $this->asUser($user)
            ->postJson("/api/v1/correspondence/letters/{$letter->id}/ai-assist/confirm", [
                'confirm' => true,
            ])
            ->assertOk();

        $letter->refresh();
        $this->assertNotNull($letter->ai_draft_confirmed_at);
        $this->assertSame($user->id, (int) $letter->ai_draft_confirmed_by);
        $this->assertNotEmpty($letter->body);
        $this->assertSame('draft', $letter->status);
        $this->assertNull($letter->sent_at);
    }

    public function test_templates_can_be_listed_and_created(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeAdmin($tenant);

        $this->asUser($user)
            ->postJson('/api/v1/correspondence/templates', [
                'name' => 'Cover letter',
                'code' => 'COVER-01',
                'subject_template' => 'Re: {{topic}}',
                'body_template' => 'Regarding {{topic}}.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'COVER-01');

        $this->asUser($user)
            ->getJson('/api/v1/correspondence/templates')
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
