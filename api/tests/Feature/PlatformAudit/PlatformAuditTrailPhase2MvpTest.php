<?php

namespace Tests\Feature\PlatformAudit;

use App\Models\PlatformAudit\AuditEvent;
use App\Models\PlatformAudit\AuditEventAlert;
use App\Models\PlatformAudit\ForensicCase;
use App\Models\PlatformAudit\ForensicEvidencePackage;
use App\Models\PlatformAudit\SecurityMonitoringRule;
use App\Models\Tenant;
use App\Modules\PlatformAudit\Services\AuditEventIngestionService;
use App\Modules\PlatformAudit\Services\ForensicCaseService;
use App\Modules\PlatformAudit\Services\SecurityMonitoringService;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class PlatformAuditTrailPhase2MvpTest extends TestCase
{
    public function test_monitoring_rules_seed_and_raise_alert_on_privileged_grant_event(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $monitoring = app(SecurityMonitoringService::class);
        $monitoring->ensureSeeded($tenant->id);

        $this->assertDatabaseHas('security_monitoring_rules', [
            'rule_key' => 'privileged_role_grant',
            'status' => 'active',
        ]);

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'identity.permission.granted',
            'actor_id' => $admin->id,
            'outcome' => 'success',
            'idempotency_key' => 'priv-grant-1',
            'source_module' => 'access-control',
        ]);

        $this->assertInstanceOf(AuditEvent::class, $event);
        $this->assertDatabaseHas('audit_event_alerts', [
            'tenant_id' => $tenant->id,
            'workflow_status' => 'new',
        ]);
    }

    public function test_alert_workflow_new_review_classify_close(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $reviewer = $this->makeAdmin($tenant);

        $rule = SecurityMonitoringRule::create([
            'tenant_id' => $tenant->id,
            'rule_key' => 'test_rule',
            'version' => 1,
            'name' => 'Test',
            'event_key_pattern' => 'auth.login.failed',
            'severity' => 'high',
            'threshold_count' => 1,
            'window_minutes' => 60,
            'enabled' => true,
            'status' => 'active',
        ]);

        $alert = AuditEventAlert::create([
            'tenant_id' => $tenant->id,
            'rule_id' => $rule->id,
            'reference' => 'ALRT-TEST01',
            'severity' => 'high',
            'status' => 'open',
            'workflow_status' => 'new',
            'detected_at' => now(),
        ]);

        $svc = app(SecurityMonitoringService::class);
        $alert = $svc->transitionAlert($alert, $reviewer, [
            'workflow_status' => 'assigned',
            'assigned_to' => $reviewer->id,
        ]);
        $this->assertSame('assigned', $alert->workflow_status);
        $this->assertSame($reviewer->id, $alert->assigned_to);
        $alert = $svc->transitionAlert($alert, $reviewer, ['workflow_status' => 'under_review']);
        $this->assertSame('under_review', $alert->workflow_status);
        $alert = $svc->transitionAlert($alert, $reviewer, [
            'workflow_status' => 'classified',
            'classification' => 'benign_noise',
        ]);
        $this->assertSame('classified', $alert->workflow_status);
        $alert = $svc->transitionAlert($alert, $reviewer, [
            'workflow_status' => 'closed',
            'conclusion' => 'closed after review',
        ]);
        $this->assertSame('closed', $alert->workflow_status);
        $this->assertNotNull($alert->closed_at);
        $this->assertDatabaseHas('audit_events', [
            'tenant_id' => $tenant->id,
            'event_key' => 'security.alert.transitioned',
            'subject_id' => $alert->id,
        ]);
    }

    public function test_forensic_case_link_hold_and_evidence_package(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $event = app(AuditEventIngestionService::class)->ingest([
            'tenant_id' => $tenant->id,
            'event_key' => 'auth.login.failed',
            'actor_id' => $admin->id,
            'outcome' => 'failure',
            'idempotency_key' => 'forensic-evt-1',
        ]);

        $forensics = app(ForensicCaseService::class);
        $case = $forensics->create($tenant->id, $admin, [
            'title' => 'Investigation Alpha',
            'notes' => 'MVP case',
        ]);

        $this->assertSame('open', $case->status);
        $this->assertNotNull($case->custody_holder_id);

        $forensics->linkEvent($case, $event->id, $admin, 'key event');
        $hold = $forensics->applyHold($case, $admin, [
            'hold_type' => 'investigation',
            'reason' => 'Case hold',
        ]);
        $this->assertSame('active', $hold->status);

        $pkg = $forensics->sealEvidencePackage($case, $admin);
        $this->assertSame('sealed', $pkg->status);
        $this->assertSame(64, strlen($pkg->manifest_hash));
        $this->assertSame(1, $pkg->event_count);

        $verify = $forensics->verifyPackage($pkg);
        $this->assertTrue($verify['valid']);

        Sanctum::actingAs($admin);
        $this->getJson('/api/v1/audit-admin/forensic-packages/'.$pkg->id.'/verify')
            ->assertOk()
            ->assertJsonPath('data.valid', true);
    }

    public function test_admin_alerts_and_forensics_endpoints(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        app(SecurityMonitoringService::class)->ensureSeeded($tenant->id);

        $this->getJson('/api/v1/audit-admin/monitoring-rules')->assertOk();
        $this->getJson('/api/v1/audit-admin/alerts')->assertOk();
        $this->postJson('/api/v1/audit-admin/forensic-cases', [
            'title' => 'API case',
        ])->assertCreated();
        $this->getJson('/api/v1/audit-admin/forensic-cases')->assertOk();
    }

    public function test_canonical_security_alert_and_forensic_routes(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $rule = SecurityMonitoringRule::create([
            'tenant_id' => $tenant->id,
            'rule_key' => 'api_route_rule',
            'version' => 1,
            'name' => 'API route rule',
            'event_key_pattern' => 'auth.login.failed',
            'severity' => 'high',
            'threshold_count' => 1,
            'window_minutes' => 60,
            'enabled' => true,
            'status' => 'active',
        ]);

        $alert = AuditEventAlert::create([
            'tenant_id' => $tenant->id,
            'rule_id' => $rule->id,
            'reference' => 'ALRT-API01',
            'severity' => 'high',
            'status' => 'open',
            'workflow_status' => 'new',
            'detected_at' => now(),
        ]);

        $this->getJson('/api/v1/security-alerts')->assertOk();
        $this->getJson('/api/v1/security-alerts/'.$alert->id)->assertOk();
        $this->postJson('/api/v1/security-alerts/'.$alert->id.'/assign', [
            'assigned_to' => $admin->id,
        ])->assertOk()->assertJsonPath('data.workflow_status', 'assigned');
        $this->postJson('/api/v1/security-alerts/'.$alert->id.'/classify', [
            'classification' => 'requires_investigation',
        ])->assertOk()->assertJsonPath('data.workflow_status', 'classified');
        $this->postJson('/api/v1/security-alerts/'.$alert->id.'/create-incident', [
            'incident_id' => 'SEC-INC-API01',
        ])->assertStatus(202)->assertJsonPath('data.workflow_status', 'confirmed_incident');
        $this->postJson('/api/v1/security-alerts/'.$alert->id.'/close', [
            'conclusion' => 'Resolved by API test',
        ])->assertOk()->assertJsonPath('data.workflow_status', 'closed');

        $caseResponse = $this->postJson('/api/v1/forensic-cases', [
            'title' => 'Canonical API case',
        ])->assertCreated();
        $this->assertNotNull($caseResponse->json('data.id'));
    }
}
