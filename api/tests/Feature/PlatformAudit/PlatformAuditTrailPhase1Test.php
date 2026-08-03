<?php

namespace Tests\Feature\PlatformAudit;

use App\Models\AuditLog;
use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventHold;
use App\Models\PlatformAudit\AuditTrailGovernanceDecision;
use App\Models\Tenant;
use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use App\Modules\PlatformAudit\Services\AuditIntegrityService;
use App\Modules\PlatformAudit\Services\AuditTrailGovernanceService;
use App\Modules\PlatformAudit\Services\EventTypeRegistryService;
use App\Modules\PlatformAudit\Services\LegacyAuditMigrationService;
use App\Modules\PlatformAudit\Services\SensitiveFieldMasker;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;
use Illuminate\Validation\ValidationException;

class PlatformAuditTrailPhase1Test extends TestCase
{
    public function test_event_type_registry_seeds_controlled_taxonomy(): void
    {
        app(EventTypeRegistryService::class)->ensureSeeded();
        $this->assertGreaterThanOrEqual(40, \App\Models\PlatformAudit\AuditEventType::query()->count());
        $this->assertDatabaseHas('audit_event_types', ['event_key' => 'auth.login.succeeded']);
        $this->assertDatabaseHas('audit_event_types', ['event_key' => 'pif.record.submitted']);
    }

    public function test_ingest_is_idempotent_by_key_and_uuid(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $svc = app(AuditEventIngestionService::class);
        $a = $svc->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'leave.request.submitted',
            'idempotency_key' => 'leave-submit-1',
            'actor_id' => $admin->id,
            'subject_type' => 'LeaveRequest',
            'subject_id' => 42,
            'outcome' => 'success',
        ]);
        $b = $svc->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'leave.request.submitted',
            'idempotency_key' => 'leave-submit-1',
            'actor_id' => $admin->id,
            'subject_type' => 'LeaveRequest',
            'subject_id' => 42,
        ]);

        $this->assertSame($a->id, $b->id);
        $this->assertSame(1, AuditEvent::query()->where('tenant_id', $tenant->id)->count());
    }

    public function test_unregistered_event_key_is_rejected_and_dead_lettered(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        try {
            app(AuditEventIngestionService::class)->ingest([
                'tenant_id' => $tenant->id,
                'event_key' => 'made.up.freeform.event',
                'actor_id' => $admin->id,
                'idempotency_key' => 'bad-event-key-1',
            ]);
            $this->fail('Unregistered event key was accepted.');
        } catch (ValidationException) {
            // Expected: producers must use the governed Event Type Registry.
        }

        $this->assertDatabaseMissing('audit_event_types', [
            'event_key' => 'made.up.freeform.event',
        ]);
        $this->assertDatabaseHas('audit_event_dead_letters', [
            'tenant_id' => $tenant->id,
            'event_key' => 'made.up.freeform.event',
            'status' => 'open',
        ]);
    }

    public function test_enqueued_events_can_be_processed_from_outbox(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $svc = app(AuditEventIngestionService::class);
        $outbox = $svc->enqueue([
            'tenant_id' => $tenant->id,
            'event_key' => 'auth.login.succeeded',
            'actor_id' => $admin->id,
            'idempotency_key' => 'queued-auth-login-1',
        ]);

        $this->assertSame('pending', $outbox->status);
        $this->assertSame(0, AuditEvent::query()->where('tenant_id', $tenant->id)->count());

        $stats = $svc->processPending($tenant->id, 10);

        $this->assertSame(1, $stats['committed']);
        $this->assertDatabaseHas('audit_events', [
            'tenant_id' => $tenant->id,
            'event_key' => 'auth.login.succeeded',
            'idempotency_key' => 'queued-auth-login-1',
        ]);
    }

    public function test_reconciliation_reports_outbox_exceptions_and_records_evidence(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        app(AuditEventIngestionService::class)->enqueue([
            'tenant_id' => $tenant->id,
            'event_key' => 'auth.login.failed',
            'actor_id' => $admin->id,
            'idempotency_key' => 'reconcile-pending-1',
        ]);

        $response = $this->postJson('/api/v1/audit-admin/reconcile');

        $response->assertOk()
            ->assertJsonPath('data.status', 'exceptions_found')
            ->assertJsonPath('data.summary.processable_outbox', 1);

        $this->assertDatabaseHas('audit_events', [
            'tenant_id' => $tenant->id,
            'event_key' => 'audit.reconciliation.completed',
            'outcome' => 'partially_completed',
        ]);
    }

    public function test_sensitive_fields_are_masked_or_excluded(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'user.profile.updated',
            'actor_id' => $admin->id,
            'idempotency_key' => 'mask-1',
            'old_values' => [
                'password' => 'Secret123!',
                'mfa_secret' => 'OTPSECRET',
                'phone' => '0812345678',
                'display_name' => 'Ada',
            ],
            'new_values' => [
                'password' => 'NewSecret!',
                'mfa_secret' => 'NEWOTP',
                'phone' => '0899999999',
                'display_name' => 'Ada Lovelace',
            ],
        ]);

        $changes = $event->changes()->get()->keyBy('field_name');
        $this->assertSame('excluded', $changes['password']->redaction_type);
        $this->assertNull($changes['password']->new_value);
        $this->assertSame('excluded', $changes['mfa_secret']->redaction_type);
        $this->assertSame('masked', $changes['phone']->redaction_type);
        $this->assertNotSame('0812345678', $changes['phone']->old_value);
        $this->assertSame('none', $changes['display_name']->redaction_type);
        $this->assertSame('Ada Lovelace', $changes['display_name']->new_value);
    }

    public function test_hash_chain_and_checkpoint(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $svc = app(AuditEventIngestionService::class);

        $svc->ingest(['tenant_id' => $tenant->id, 'event_key' => 'auth.login.succeeded', 'actor_id' => $admin->id, 'idempotency_key' => 'c1']);
        $svc->ingest(['tenant_id' => $tenant->id, 'event_key' => 'auth.logout', 'actor_id' => $admin->id, 'idempotency_key' => 'c2']);

        $integrity = app(AuditIntegrityService::class);
        $result = $integrity->verifyChain($tenant->id);
        $this->assertTrue($result['valid']);
        $this->assertSame(2, $result['checked']);

        $cp = $integrity->createCheckpoint($tenant->id, $admin);
        $this->assertSame('valid', $cp->status);
        $this->assertSame(2, $cp->event_count);
        $this->assertDatabaseHas('audit_events', [
            'tenant_id' => $tenant->id,
            'event_key' => 'audit.checkpoint.created',
            'subject_id' => $cp->id,
        ]);

        $this->getJson('/api/v1/audit-integrity/reports/'.$cp->id)
            ->assertOk()
            ->assertJsonPath('data.verification.valid', true)
            ->assertJsonPath('data.checkpoint.id', $cp->id);

        $this->assertDatabaseHas('audit_event_access_logs', [
            'tenant_id' => $tenant->id,
            'viewer_user_id' => $admin->id,
            'access_type' => 'integrity_report',
        ]);
    }

    public function test_holds_block_disposal_flag(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'pif.record.approved',
            'actor_id' => $admin->id,
            'idempotency_key' => 'hold-target',
        ]);

        $hold = app(\App\Modules\PlatformAudit\Services\AuditHoldService::class)->place($tenant->id, $admin, [
            'hold_type' => 'legal',
            'scope_type' => 'event',
            'audit_event_id' => $event->id,
            'reason' => 'Investigation hold',
        ]);

        $this->assertSame('active', $hold->status);
        $this->assertTrue(app(\App\Modules\PlatformAudit\Services\AuditHoldService::class)->isEventOnHold($event));
    }

    public function test_search_requires_permission_and_logs_access(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($staff);

        // Staff without search permission gets 403 for global search
        $this->getJson('/api/v1/audit-events')->assertForbidden();

        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'system.config.updated',
            'actor_id' => $admin->id,
            'idempotency_key' => 'search-1',
        ]);

        $this->getJson('/api/v1/audit-events')->assertOk();
        $this->assertDatabaseHas('audit_event_access_logs', [
            'viewer_user_id' => $admin->id,
            'access_type' => 'search',
        ]);
        $this->assertDatabaseHas('audit_events', [
            'tenant_id' => $tenant->id,
            'event_key' => 'audit.access.logged',
            'actor_id' => $admin->id,
            'subject_type' => \App\Models\PlatformAudit\AuditEventAccessLog::class,
        ]);
    }

    public function test_committed_events_cannot_be_updated_or_deleted_via_eloquent(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'auth.login.succeeded',
            'actor_id' => $admin->id,
            'idempotency_key' => 'immut-1',
        ]);

        $event->outcome = 'failed';
        $this->assertFalse($event->save());
        $this->assertFalse($event->delete());
        $this->assertDatabaseHas('audit_events', ['id' => $event->id, 'outcome' => 'success']);
    }

    public function test_audit_log_record_dual_writes_and_pif_history_still_works(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $log = AuditLog::record('programme.submitted', [
            'auditable_type' => 'App\\Models\\Programme',
            'auditable_id' => 99,
            'tags' => 'programme',
            'new_values' => ['status' => 'submitted'],
        ]);

        $this->assertNotNull($log->id);
        $this->assertDatabaseHas('audit_logs', ['id' => $log->id, 'event' => 'programme.submitted']);
        $this->assertDatabaseHas('audit_events', [
            'legacy_audit_log_id' => $log->id,
            'event_key' => 'pif.record.submitted',
        ]);

        $history = $this->getJson('/api/v1/records/Programme/99/audit-history');
        $history->assertOk();
        $this->assertGreaterThanOrEqual(1, count($history->json('data')));
    }

    public function test_legacy_migration_does_not_fabricate_ip(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);

        $log = AuditLog::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $admin->id,
            'event' => 'programme.approved',
            'auditable_type' => 'App\\Models\\Programme',
            'auditable_id' => 7,
            'old_values' => null,
            'new_values' => ['status' => 'approved'],
            'url' => null,
            'ip_address' => null,
            'user_agent' => null,
            'tags' => 'programme',
            'previous_hash' => '0',
            'entry_hash' => hash('sha256', 'migr-test'),
            'created_at' => now()->subDay(),
        ]);

        // Fixture created via query()->create() — no dual-write; migrate explicitly.
        $stats = app(LegacyAuditMigrationService::class)->migrateTenant($tenant->id, 100);
        $this->assertGreaterThanOrEqual(1, $stats['partial'] + $stats['migrated'] + $stats['unmapped']);

        $migrated = AuditEvent::query()->where('legacy_audit_log_id', $log->id)->first();
        $this->assertNotNull($migrated);
        $this->assertNull($migrated->ip_address);
        $this->assertNull($migrated->user_agent);
        $this->assertSame('Migrated-Partial', $migrated->migration_status);
        $this->assertSame('pif.record.approved', $migrated->event_key);
    }

    public function test_governance_checklist_seeds_pending_items(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $response = $this->getJson('/api/v1/audit-admin/governance');
        $response->assertOk();
        $data = $response->json('data');
        $this->assertCount(20, $data);
        foreach ($data as $row) {
            $this->assertSame('pending', $row['status']);
        }
        $this->assertSame(
            'Governance Configuration Pending',
            $response->json('meta.phase2_stubs.siem')
        );

        $keys = array_column(AuditTrailGovernanceService::catalogue(), 'key');
        $this->assertContains('event_retention_periods', $keys);
        $this->assertContains('siem_integration', $keys);

        $this->putJson('/api/v1/audit-admin/governance/'.$data[0]['id'], [
            'status' => 'decided',
            'decision_notes' => 'Approved for test',
        ])->assertOk();

        $this->assertDatabaseHas('audit_events', [
            'tenant_id' => $tenant->id,
            'event_key' => 'audit.governance.updated',
            'subject_id' => $data[0]['id'],
        ]);
    }

    public function test_staff_cannot_manage_governance(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($staff);
        $this->getJson('/api/v1/audit-admin/governance')->assertForbidden();
    }

    public function test_masker_never_keeps_passwords_or_tokens(): void
    {
        $masker = new SensitiveFieldMasker();
        $result = $masker->scrub([
            'password' => 'x',
            'access_token' => 'tok',
            'recovery_codes' => ['a', 'b'],
            'name' => 'ok',
        ]);
        $this->assertArrayNotHasKey('password', $result['values']);
        $this->assertArrayNotHasKey('access_token', $result['values']);
        $this->assertArrayNotHasKey('recovery_codes', $result['values']);
        $this->assertSame('ok', $result['values']['name']);
    }
}
