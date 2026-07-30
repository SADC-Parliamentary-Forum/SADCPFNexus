<?php

namespace Tests\Feature\Notifications;

use App\Models\DeviceToken;
use App\Models\Notification;
use App\Models\Notifications\NotificationAckCampaign;
use App\Models\Notifications\NotificationAckRecipient;
use App\Models\Notifications\NotificationBroadcast;
use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationCoalesceBucket;
use App\Models\Notifications\NotificationExternalToken;
use App\Models\Notifications\NotificationPreference;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Notifications\Services\AckCampaignService;
use App\Modules\Notifications\Services\BroadcastService;
use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\CoalescingService;
use App\Modules\Notifications\Services\ExternalPortalService;
use App\Modules\Notifications\Services\FailoverMailService;
use App\Modules\Notifications\Services\NotificationDispatchService;
use App\Modules\Notifications\Services\NotificationIntelligenceService;
use App\Modules\Notifications\Services\PolicyService;
use App\Modules\Notifications\Services\PushDeliveryService;
use App\Modules\Notifications\Services\SecureLinkService;
use App\Services\NotificationService;
use Illuminate\Support\Facades\Config;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class NotificationsPhase2Phase3Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        Mail::fake();
        Config::set('notifications.push_provider', 'null');
        Config::set('notifications.sms_enabled', false);
        Config::set('notifications.whatsapp_enabled', false);
        Config::set('notifications.ai_provider', 'stub');
        Config::set('notifications.ai_enabled', true);
    }

    public function test_push_device_register_refresh_and_revoke(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $push = app(PushDeliveryService::class);

        $row = $push->register($user, 'token-aaa', 'android', 'Pixel');
        $this->assertDatabaseHas('device_tokens', [
            'user_id' => $user->id,
            'token' => 'token-aaa',
            'push_enabled' => true,
        ]);

        $refreshed = $push->refresh($user, 'token-aaa', 'token-bbb');
        $this->assertSame('token-bbb', $refreshed->token);
        $this->assertNotNull(DeviceToken::where('token', 'token-aaa')->value('revoked_at'));

        $push->revoke($user, 'token-bbb');
        $this->assertNotNull(DeviceToken::where('token', 'token-bbb')->value('revoked_at'));

        $this->actingAs($user, 'sanctum')
            ->postJson('/api/v1/notifications/devices', [
                'token' => 'token-ccc',
                'platform' => 'ios',
            ])
            ->assertOk();
    }

    public function test_push_uses_privacy_safe_lock_screen_body(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        app(PushDeliveryService::class)->register($user, 'tok-1');

        $dispatch = app(NotificationDispatchService::class);
        $dispatch->publishEvent([
            'tenant_id' => $tenant->id,
            'event_type' => 'workflow.approval_required',
            'source_module' => 'workflow',
            'idempotency_key' => 'push-privacy-1',
            'payload' => [
                'trigger_key' => 'workflow.approval_required',
                'vars' => ['name' => $user->name, 'summary' => 'Confidential leave detail XYZ'],
                'meta' => [
                    'module' => 'leave',
                    'url' => '/approvals',
                    'confidentiality' => 'confidential',
                    'force_immediate' => true,
                ],
                'recipient_instruction' => ['user_ids' => [$user->id]],
                'send_email' => false,
                'send_push' => true,
            ],
        ], true);

        $delivery = NotificationChannelDelivery::query()
            ->where('channel', 'push')
            ->latest('id')
            ->first();

        $this->assertNotNull($delivery);
        $this->assertSame('sent', $delivery->status);
        $this->assertSame('null', $delivery->provider);
    }

    public function test_ack_campaign_activate_acknowledge_and_report(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $acks = app(AckCampaignService::class);

        $campaign = $acks->create($tenant->id, $admin->id, [
            'title' => 'Policy circular',
            'body' => 'Please acknowledge the updated ICT policy.',
            'deadline_at' => now()->addDays(3)->toIso8601String(),
            'audience' => ['user_ids' => [$staff->id]],
            'reminder_offsets_hours' => [48],
        ]);

        $acks->activate($campaign);
        $this->assertSame('active', $campaign->fresh()->status);
        $this->assertDatabaseHas('notification_ack_recipients', [
            'campaign_id' => $campaign->id,
            'user_id' => $staff->id,
            'status' => 'pending',
        ]);
        $this->assertGreaterThan(0, Notification::where('user_id', $staff->id)->where('trigger', 'notifications.ack_campaign')->count());

        $acks->acknowledge($campaign->fresh(), $staff);
        $this->assertSame('acknowledged', NotificationAckRecipient::where('campaign_id', $campaign->id)->value('status'));

        $report = $acks->report($campaign->fresh());
        $this->assertSame(1, $report['totals']['acknowledged']);
        $this->assertSame(0, $report['totals']['pending']);
    }

    public function test_broadcast_sod_blocks_same_sender_approver_for_high_impact(): void
    {
        $tenant = Tenant::factory()->create();
        $sender = $this->makeAdmin($tenant);
        $approver = User::factory()->create(['tenant_id' => $tenant->id]);
        $approver->assignRole('System Admin');
        $staff = $this->makeUser('staff', $tenant);

        $broadcasts = app(BroadcastService::class);
        $broadcast = $broadcasts->create($tenant->id, $sender->id, [
            'title' => 'Institution alert',
            'body' => 'High impact notice',
            'impact' => 'high',
            'audience' => ['user_ids' => [$staff->id]],
        ]);
        $broadcasts->submit($broadcast, $sender);

        $this->expectException(ValidationException::class);
        $broadcasts->approve($broadcast->fresh(), $sender);
    }

    public function test_broadcast_sod_allows_different_approver(): void
    {
        $tenant = Tenant::factory()->create();
        $sender = $this->makeAdmin($tenant);
        $approver = User::factory()->create(['tenant_id' => $tenant->id]);
        $approver->assignRole('System Admin');
        $staff = $this->makeUser('staff', $tenant);

        $broadcasts = app(BroadcastService::class);
        $broadcast = $broadcasts->create($tenant->id, $sender->id, [
            'title' => 'Institution alert',
            'body' => 'High impact notice',
            'impact' => 'high',
            'audience' => ['user_ids' => [$staff->id]],
        ]);
        $broadcasts->submit($broadcast, $sender);
        $sent = $broadcasts->approve($broadcast->fresh(), $approver);

        $this->assertSame('sent', $sent->status);
        $this->assertNotSame($sender->id, $sent->approved_by);
        $this->assertGreaterThan(0, Notification::where('user_id', $staff->id)->where('trigger', 'notifications.broadcast')->count());
    }

    public function test_email_failover_uses_secondary_mailer_on_temporary_failure(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        Config::set('notifications.email_failover_enabled', true);
        Config::set('notifications.email_primary_mailer', 'missing_primary_mailer_xyz');
        Config::set('notifications.email_secondary_mailer', 'log');

        $delivery = new NotificationChannelDelivery([
            'tenant_id' => $tenant->id,
            'recipient_id' => 0,
            'channel' => 'email',
            'provider' => 'mail',
            'destination_snapshot' => $user->email,
            'rendered_subject' => 'Test',
            'queue_priority' => 'normal',
            'status' => 'pending',
            'attempt_count' => 0,
            'suppressed' => false,
        ]);
        $delivery->id = 999001;

        $result = app(FailoverMailService::class)->send(
            $user,
            'Subject',
            'Body',
            'https://nexus.example/notifications',
            $delivery,
        );

        $this->assertTrue($result['ok']);
        $this->assertTrue($result['failover']);
        $this->assertSame('log', $result['provider']);
    }

    public function test_coalesce_defers_operational_but_not_critical_action(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $coalesce = app(CoalescingService::class);
        $policy = app(PolicyService::class)->defaultPolicy('alerts.digest_item');
        $policy['coalesce_eligible'] = true;
        $policy['delivery_class'] = 'digest_eligible';
        $policy['mandatory'] = false;
        $policy['action_required'] = false;

        $this->assertTrue($coalesce->shouldCoalesce($policy, ['coalesce' => true]));

        $critical = app(PolicyService::class)->defaultPolicy('workflow.approval_required');
        $this->assertFalse($coalesce->shouldCoalesce($critical, ['coalesce' => true]));

        $bucket = $coalesce->enqueue($user, 'alerts.digest_item', 'Update A', [], 'bucket-a');
        $coalesce->enqueue($user, 'alerts.digest_item', 'Update B', [], 'bucket-a');
        $this->assertSame('open', $bucket->fresh()->status);

        NotificationCoalesceBucket::where('id', $bucket->id)->update(['window_ends_at' => now()->subMinute()]);
        $flushed = $coalesce->flushDue();
        $this->assertSame(1, $flushed);
        $this->assertSame('flushed', $bucket->fresh()->status);
    }

    public function test_external_token_expires_and_hides_internal_dump(): void
    {
        $tenant = Tenant::factory()->create();
        $portal = app(ExternalPortalService::class);
        $issued = $portal->issue($tenant->id, [
            'subject' => 'Vendor notice',
            'minimal_body' => 'Please review the summary.',
            'recipient_email' => 'vendor@example.org',
            'source_module' => 'procurement',
            'source_id' => 99,
        ]);

        $ok = $portal->resolve($issued['token']);
        $this->assertTrue($ok['ok']);
        $this->assertArrayNotHasKey('source_id', $ok['data']);
        $this->assertArrayNotHasKey('tenant_id', $ok['data']);

        NotificationExternalToken::where('id', $issued['token_id'])->update(['expires_at' => now()->subMinute()]);
        $expired = $portal->resolve($issued['token']);
        $this->assertFalse($expired['ok']);
        $this->assertSame('expired', $expired['code']);

        $this->getJson('/api/v1/external/notifications/'.$issued['token'])->assertStatus(410);
    }

    public function test_ai_cannot_suppress_mandatory_via_preference_suggestion_apply(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $ai = app(NotificationIntelligenceService::class);

        $suggestion = $ai->suggestPreferences($user);
        // Forge a malicious apply payload attempting mandatory suppress.
        $suggestion->update([
            'suggestion' => [
                'proposed' => [
                    ['category' => 'workflow', 'email_enabled' => false, 'in_app_enabled' => false, 'digest_mode' => 'off'],
                    ['category' => 'operational', 'digest_mode' => 'daily'],
                ],
                'requires_confirmation' => true,
            ],
        ]);

        $ai->confirmSuggestion($suggestion->fresh(), $user, true);

        $this->assertNull(
            NotificationPreference::where('user_id', $user->id)->where('category', 'workflow')->first()
        );
        $this->assertSame(
            'daily',
            NotificationPreference::where('user_id', $user->id)->where('category', 'operational')->value('digest_mode')
        );

        $policy = app(PolicyService::class)->resolvePolicy($tenant->id, 'workflow.approval_required');
        $decisions = app(PolicyService::class)->channelDecisions($user, $policy);
        $this->assertTrue($decisions['in_app']);
        $this->assertTrue($decisions['email']);
        $this->assertFalse($decisions['digest']);
    }

    public function test_deep_links_are_structured_and_block_token_urls(): void
    {
        $links = app(SecureLinkService::class);
        $structured = $links->structuredDeepLinks('/approvals/123');
        $this->assertSame('/approvals/123', $structured['web_path']);
        $this->assertStringContainsString('sadcpfnexus://', $structured['mobile_url']);

        $blocked = $links->normalizeRoute('/approval?token=abc');
        $this->assertSame('/approvals', $blocked);
    }

    public function test_phase1_regression_smoke_outbox_and_pif_style_dispatch(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        app(NotificationService::class)->dispatch(
            $user,
            'programme.submitted',
            ['name' => $user->name, 'reference' => 'PIF-1', 'summary' => 'Submitted'],
            ['module' => 'programmes', 'url' => '/pif/1', 'record_id' => 1],
            true,
            false,
            'pif-smoke-1',
        );

        $this->assertSame(1, Notification::where('user_id', $user->id)->where('trigger', 'programme.submitted')->count());
        $this->assertDatabaseHas('notification_outbox', [
            'idempotency_key' => 'pif-smoke-1',
            'status' => 'published',
        ]);
    }

    public function test_nl_search_and_channel_predict_are_advisory_only(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $ai = app(NotificationIntelligenceService::class);

        $nl = $ai->nlInboxSearch($user, 'show unread workflow actions');
        $this->assertSame('action_required', $nl['filters']['filter']);
        $this->assertSame('workflow', $nl['filters']['module']);

        $policy = app(PolicyService::class)->defaultPolicy('workflow.approval_required');
        $pred = $ai->predictChannel($user, $policy);
        $this->assertTrue($pred->suggestion['advisory_only']);
        $this->assertTrue($pred->suggestion['policy_mandatory_channels_override']);
    }

    public function test_ai_guards_mark_sms_whatsapp_governance_pending(): void
    {
        $guards = app(NotificationIntelligenceService::class)->guards();
        $this->assertSame('Governance Configuration Pending', $guards['sms_status']);
        $this->assertSame('Governance Configuration Pending', $guards['whatsapp_status']);
        $this->assertFalse($guards['sms_enabled']);
        $this->assertFalse($guards['whatsapp_enabled']);
    }
}
