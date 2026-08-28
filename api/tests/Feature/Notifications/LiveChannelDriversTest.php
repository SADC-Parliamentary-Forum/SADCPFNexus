<?php

namespace Tests\Feature\Notifications;

use App\Models\Notifications\NotificationChannelDelivery;
use App\Models\Notifications\NotificationDigest;
use App\Models\Notifications\NotificationDigestItem;
use App\Models\Notifications\NotificationEvent;
use App\Models\Notifications\NotificationRecord;
use App\Models\Notifications\NotificationRecipient;
use App\Models\Tenant;
use App\Modules\Notifications\Services\ChannelDeliveryService;
use App\Modules\Notifications\Services\HttpChannelProvider;
use App\Modules\Notifications\Services\NotificationIntelligenceService;
use App\Modules\Notifications\Services\OutboundChannelResolver;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class LiveChannelDriversTest extends TestCase
{
    public function test_default_sms_and_whatsapp_remain_governance_pending_null_stubs(): void
    {
        $resolver = app(OutboundChannelResolver::class);

        $this->assertFalse($resolver->sms()->isEnabled());
        $this->assertFalse($resolver->whatsapp()->isEnabled());
        $this->assertSame('Governance Configuration Pending', $resolver->sms()->status());
        $this->assertSame('Governance Configuration Pending', $resolver->whatsapp()->status());
        $this->assertFalse((bool) config('notifications.sms_enabled'));
        $this->assertFalse((bool) config('notifications.whatsapp_enabled'));
    }

    public function test_http_sms_without_url_stays_credentials_pending_and_does_not_post(): void
    {
        config([
            'notifications.sms_provider' => 'http',
            'notifications.sms_http_url' => null,
            'notifications.sms_http_token' => null,
        ]);
        Http::fake();

        $sms = app(OutboundChannelResolver::class)->sms();
        $this->assertFalse($sms->isEnabled());
        $this->assertSame('Credentials Pending', $sms->status());

        $result = $sms->send('+264811111111', 'UAT reminder');
        $this->assertFalse($result['ok']);
        $this->assertSame('sms_credentials_pending', $result['code']);
        Http::assertNothingSent();
    }

    public function test_http_sms_posts_when_url_is_configured_and_marks_delivery_sent(): void
    {
        config([
            'notifications.sms_provider' => 'http',
            'notifications.sms_http_url' => 'https://sms.example.test/send',
            'notifications.sms_http_token' => 'test-token',
        ]);
        Http::fake([
            'https://sms.example.test/send' => Http::response(['id' => 'sms-99'], 200),
        ]);

        $sms = app(OutboundChannelResolver::class)->sms();
        $this->assertTrue($sms->isEnabled());
        $this->assertSame('HTTP driver configured', $sms->status());
        $this->assertInstanceOf(HttpChannelProvider::class, $sms);

        $delivery = $this->makeChannelDelivery('sms', '+264811111111');
        $updated = app(ChannelDeliveryService::class)->attemptSms(
            $delivery,
            '+264811111111',
            'Approve leave request'
        );

        $this->assertSame('sent', $updated->status);
        $this->assertFalse((bool) $updated->suppressed);
        $this->assertSame('http_sms', $updated->provider);
        Http::assertSent(function ($request) {
            return $request->url() === 'https://sms.example.test/send'
                && $request->hasHeader('Authorization', 'Bearer test-token')
                && $request['channel'] === 'sms'
                && $request['destination'] === '+264811111111'
                && $request['body'] === 'Approve leave request';
        });
    }

    public function test_http_whatsapp_posts_when_url_is_configured(): void
    {
        config([
            'notifications.whatsapp_provider' => 'http',
            'notifications.whatsapp_http_url' => 'https://wa.example.test/messages',
            'notifications.whatsapp_http_token' => 'wa-token',
        ]);
        Http::fake([
            'https://wa.example.test/messages' => Http::response(['id' => 'wa-1'], 202),
        ]);

        $delivery = $this->makeChannelDelivery('whatsapp', '+264822222222');
        $updated = app(ChannelDeliveryService::class)->attemptWhatsApp(
            $delivery,
            '+264822222222',
            'Circular acknowledgement required'
        );

        $this->assertSame('sent', $updated->status);
        $this->assertSame('http_whatsapp', $updated->provider);
        Http::assertSent(fn ($request) => $request['channel'] === 'whatsapp'
            && $request['destination'] === '+264822222222');
    }

    public function test_http_sms_5xx_is_temporary_failure_not_suppressed(): void
    {
        config([
            'notifications.sms_provider' => 'http',
            'notifications.sms_http_url' => 'https://sms.example.test/send',
            'notifications.sms_http_token' => 't',
        ]);
        Http::fake([
            'https://sms.example.test/send' => Http::response('upstream down', 503),
        ]);

        $updated = app(ChannelDeliveryService::class)->attemptSms(
            $this->makeChannelDelivery('sms', '+264811111111'),
            '+264811111111',
            'Retry me'
        );

        $this->assertSame('retry_scheduled', $updated->status);
        $this->assertFalse((bool) $updated->suppressed);
        $this->assertSame('http_503', $updated->failure_code);
    }

    public function test_empty_destination_is_permanent_failure(): void
    {
        config([
            'notifications.sms_provider' => 'http',
            'notifications.sms_http_url' => 'https://sms.example.test/send',
            'notifications.sms_http_token' => 't',
        ]);
        Http::fake();

        $updated = app(ChannelDeliveryService::class)->attemptSms(
            $this->makeChannelDelivery('sms', ''),
            '',
            'No phone'
        );

        $this->assertSame('failed', $updated->status);
        $this->assertSame('missing_destination', $updated->failure_code);
        Http::assertNothingSent();
    }

    public function test_null_sms_attempt_stays_suppressed_without_http(): void
    {
        Http::fake();
        $updated = app(ChannelDeliveryService::class)->attemptSms(
            $this->makeChannelDelivery('sms', '+264811111111'),
            '+264811111111',
            'Should not send'
        );

        $this->assertSame('suppressed', $updated->status);
        $this->assertSame('sms_governance_pending', $updated->suppression_reason);
        Http::assertNothingSent();
    }

    public function test_digest_http_llm_uses_provider_summary_without_inventing_events(): void
    {
        config([
            'notifications.ai_provider' => 'http',
            'notifications.ai_http_url' => 'https://llm.example.test/summarise',
            'notifications.ai_http_token' => 'llm-token',
            'notifications.ai_enabled' => true,
        ]);
        Http::fake([
            'https://llm.example.test/summarise' => Http::response([
                'summary' => 'Two existing notices: leave submitted; travel routed.',
            ], 200),
        ]);

        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $digest = NotificationDigest::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'digest_type' => 'daily',
            'period_start' => now()->toDateString(),
            'period_end' => now()->toDateString(),
            'status' => 'pending',
        ]);
        NotificationDigestItem::create([
            'digest_id' => $digest->id,
            'channel_delivery_id' => $this->makeChannelDeliveryForUser($user, 'email')->id,
            'summary' => 'Leave submitted',
        ]);
        NotificationDigestItem::create([
            'digest_id' => $digest->id,
            'channel_delivery_id' => $this->makeChannelDeliveryForUser($user, 'email')->id,
            'summary' => 'Travel routed',
        ]);

        $suggestion = app(NotificationIntelligenceService::class)->summariseDigest($digest);

        $this->assertSame('Two existing notices: leave submitted; travel routed.', $suggestion->suggestion['summary']);
        $this->assertFalse($suggestion->suggestion['invented']);
        $this->assertSame('pending', $suggestion->status);
        $this->assertSame('http', $suggestion->provider);
        Http::assertSent(fn ($request) => $request['task'] === 'digest_summarise'
            && $request['rules']['do_not_invent_events'] === true
            && $request['items'] === ['Leave submitted', 'Travel routed']);
    }

    public function test_digest_http_llm_falls_back_to_stub_when_url_missing(): void
    {
        config([
            'notifications.ai_provider' => 'http',
            'notifications.ai_http_url' => null,
            'notifications.ai_http_token' => 'llm-token',
        ]);
        Http::fake();

        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $digest = NotificationDigest::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'digest_type' => 'daily',
            'period_start' => now()->toDateString(),
            'period_end' => now()->toDateString(),
            'status' => 'pending',
        ]);
        NotificationDigestItem::create([
            'digest_id' => $digest->id,
            'channel_delivery_id' => $this->makeChannelDeliveryForUser($user, 'email')->id,
            'summary' => 'Only existing item',
        ]);

        $suggestion = app(NotificationIntelligenceService::class)->summariseDigest($digest);
        $this->assertStringContainsString('Only existing item', $suggestion->suggestion['summary']);
        Http::assertNothingSent();
    }

    public function test_ai_guards_report_http_driver_when_sms_credentials_exist(): void
    {
        config([
            'notifications.sms_provider' => 'http',
            'notifications.sms_http_url' => 'https://sms.example.test/send',
            'notifications.sms_http_token' => 't',
            'notifications.whatsapp_provider' => 'null',
        ]);

        $guards = app(NotificationIntelligenceService::class)->guards();
        $this->assertSame('HTTP driver configured', $guards['sms_status']);
        $this->assertTrue($guards['sms_enabled']);
        $this->assertSame('Governance Configuration Pending', $guards['whatsapp_status']);
        $this->assertFalse($guards['whatsapp_enabled']);
    }

    private function makeChannelDelivery(string $channel, string $destination): NotificationChannelDelivery
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);

        return $this->makeChannelDeliveryForUser($user, $channel, $destination);
    }

    private function makeChannelDeliveryForUser(
        \App\Models\User $user,
        string $channel,
        string $destination = 'inbox',
    ): NotificationChannelDelivery {
        $event = NotificationEvent::create([
            'tenant_id' => $user->tenant_id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'event_key' => 'test.sms',
            'event_type' => 'test.sms',
            'source_module' => 'notifications',
            'occurred_at' => now(),
            'idempotency_key' => 'live-channel-'.\Illuminate\Support\Str::uuid(),
            'status' => 'consumed',
        ]);
        $record = NotificationRecord::create([
            'tenant_id' => $user->tenant_id,
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'event_id' => $event->id,
            'notification_type' => 'test.sms',
            'template_key' => 'test.sms',
            'status' => 'active',
        ]);
        $recipient = NotificationRecipient::create([
            'tenant_id' => $user->tenant_id,
            'notification_record_id' => $record->id,
            'user_id' => $user->id,
            'status' => 'active',
            'resolved_at' => now(),
        ]);

        return app(ChannelDeliveryService::class)->createDelivery(
            (int) $user->tenant_id,
            $recipient->id,
            $channel,
            ['queue_priority' => 'normal'],
            ['subject' => 'Test', 'body' => 'Test body'],
            $destination,
            null,
        );
    }
}
