<?php

namespace Tests\Feature\PlatformAudit;

use App\Models\Tenant;
use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use Illuminate\Support\Facades\Http;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class SiemHttpSinkTest extends TestCase
{
    public function test_siem_http_sink_does_not_post_when_driver_is_null(): void
    {
        config([
            'audit.siem_driver' => 'null',
            'audit.siem_http_url' => 'https://siem.example.test/events',
            'audit.siem_http_token' => 'should-not-send',
        ]);
        Http::fake();

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'leave.request.submitted',
            'idempotency_key' => 'siem-null-1',
            'actor_id' => $admin->id,
            'subject_type' => 'LeaveRequest',
            'subject_id' => 1,
            'outcome' => 'success',
        ]);

        Http::assertNothingSent();
    }

    public function test_siem_http_sink_posts_sanitized_event_when_configured(): void
    {
        config([
            'audit.siem_driver' => 'http',
            'audit.siem_http_url' => 'https://siem.example.test/events',
            'audit.siem_http_token' => 'siem-token',
        ]);
        Http::fake([
            'https://siem.example.test/events' => Http::response(['ok' => true], 202),
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'leave.request.submitted',
            'idempotency_key' => 'siem-http-1',
            'actor_id' => $admin->id,
            'subject_type' => 'LeaveRequest',
            'subject_id' => 99,
            'outcome' => 'success',
        ]);

        $this->assertNotNull($event->id);
        Http::assertSent(function ($request) use ($event, $tenant) {
            return $request->url() === 'https://siem.example.test/events'
                && $request->hasHeader('Authorization', 'Bearer siem-token')
                && $request['uuid'] === $event->uuid
                && $request['event_key'] === 'leave.request.submitted'
                && (int) $request['tenant_id'] === $tenant->id
                && $request['outcome'] === 'success'
                && ! array_key_exists('siem_http_token', $request->data());
        });
    }

    public function test_siem_http_sink_failure_does_not_roll_back_ingest(): void
    {
        config([
            'audit.siem_driver' => 'http',
            'audit.siem_http_url' => 'https://siem.example.test/events',
            'audit.siem_http_token' => 'siem-token',
        ]);
        Http::fake([
            'https://siem.example.test/events' => Http::response('nope', 500),
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'leave.request.submitted',
            'idempotency_key' => 'siem-http-fail-1',
            'actor_id' => $admin->id,
            'subject_type' => 'LeaveRequest',
            'subject_id' => 7,
            'outcome' => 'success',
        ]);

        $this->assertDatabaseHas('audit_events', [
            'id' => $event->id,
            'event_key' => 'leave.request.submitted',
        ]);
    }
}
