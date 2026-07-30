<?php

namespace Tests\Feature\Notifications;

use App\Models\Notifications\NotificationGovernanceDecision;
use App\Models\Tenant;
use App\Modules\Notifications\Services\GovernanceChecklistService;
use App\Modules\Notifications\Services\NullSmsProvider;
use App\Modules\Notifications\Services\NullWhatsAppProvider;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class NotificationGovernanceChecklistTest extends TestCase
{
    public function test_checklist_seeds_sixteen_pending_items(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/notification-admin/governance');
        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(16, $data);
        foreach ($data as $row) {
            $this->assertSame('pending', $row['status']);
            $this->assertNull($row['decided_by']);
            $this->assertNull($row['decision_notes']);
        }
        $this->assertSame(
            'Governance Configuration Pending',
            $response->json('meta.channel_status.sms')
        );
        $this->assertSame(
            'Governance Configuration Pending',
            $response->json('meta.channel_status.whatsapp')
        );
    }

    public function test_sms_whatsapp_providers_remain_governance_pending_stubs(): void
    {
        $this->assertSame('Governance Configuration Pending', app(NullSmsProvider::class)->status());
        $this->assertSame('Governance Configuration Pending', app(NullWhatsAppProvider::class)->status());
        $this->assertFalse(app(NullSmsProvider::class)->isEnabled());
        $this->assertFalse(app(NullWhatsAppProvider::class)->isEnabled());
    }

    public function test_admin_can_mark_decided_without_inventing_defaults(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        app(GovernanceChecklistService::class)->ensureSeeded($tenant);
        $row = NotificationGovernanceDecision::query()
            ->where('tenant_id', $tenant->id)
            ->where('decision_key', 'sms_whatsapp_approval')
            ->firstOrFail();

        $this->assertSame('pending', $row->status);

        $response = $this->putJson("/api/v1/notification-admin/governance/{$row->id}", [
            'status' => 'decided',
            'decision_notes' => 'ICT Policy review scheduled — no live SMS yet.',
        ]);
        $response->assertOk()
            ->assertJsonPath('data.status', 'decided')
            ->assertJsonPath('data.decided_by', $admin->id);

        $this->assertDatabaseHas('notification_governance_decisions', [
            'id' => $row->id,
            'status' => 'decided',
            'decision_notes' => 'ICT Policy review scheduled — no live SMS yet.',
        ]);
    }

    public function test_staff_cannot_access_governance_checklist(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($staff);

        $this->getJson('/api/v1/notification-admin/governance')->assertForbidden();
    }

    public function test_catalogue_keys_match_prd_section_124(): void
    {
        $keys = array_column(GovernanceChecklistService::catalogue(), 'key');
        $this->assertSame([
            'official_email_provider',
            'mandatory_categories',
            'digest_eligible_categories',
            'quiet_hours_rules',
            'critical_override_rules',
            'retention_periods',
            'circular_acknowledgements',
            'external_secure_tokens',
            'mobile_push_rollout',
            'sms_whatsapp_approval',
            'approved_broadcast_senders',
            'template_approval_authority',
            'delivery_service_targets',
            'bounce_escalation',
            'email_open_tracking',
            'confidential_in_app_only',
        ], $keys);
    }
}
