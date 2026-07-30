<?php

namespace Tests\Feature\Audit;

use App\Models\AuditAiSuggestion;
use App\Models\AuditEngagement;
use App\Models\AuditExternalAppointment;
use App\Models\AuditExternalEngagement;
use App\Models\AuditFinding;
use App\Models\AuditIndependenceDeclaration;
use App\Models\AuditPlan;
use App\Models\AuditSample;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Audit\Services\AuditAiAssistService;
use Illuminate\Support\Facades\Schema;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditManagementPhase2Phase3Test extends TestCase
{
    private function asInternalAuditor(?Tenant $tenant = null): array
    {
        $user = $this->makeUser('Internal Auditor', $tenant);
        Sanctum::actingAs($user);

        return [$this, $user];
    }

    private function seedEngagement(User $auditor, array $overrides = []): AuditEngagement
    {
        $plan = AuditPlan::create([
            'tenant_id' => $auditor->tenant_id,
            'title' => 'Annual Plan '.uniqid(),
            'fiscal_year' => 2026,
            'version' => 1,
            'status' => 'approved',
            'created_by' => $auditor->id,
        ]);

        $engagement = AuditEngagement::create(array_merge([
            'tenant_id' => $auditor->tenant_id,
            'audit_plan_id' => $plan->id,
            'title' => 'Engagement '.uniqid(),
            'status' => 'fieldwork',
            'lead_auditor_id' => $auditor->id,
            'created_by' => $auditor->id,
            'confidentiality_level' => 'restricted',
        ], $overrides));

        AuditIndependenceDeclaration::create([
            'tenant_id' => $auditor->tenant_id,
            'engagement_id' => $engagement->id,
            'user_id' => $auditor->id,
            'status' => 'cleared',
            'declared_at' => now(),
        ]);

        return $engagement;
    }

    public function test_sample_population_freezes_and_requires_justification_to_adjust(): void
    {
        $this->assertTrue(Schema::hasColumn('audit_samples', 'is_frozen'));

        [, $auditor] = $this->asInternalAuditor();
        $engagement = $this->seedEngagement($auditor);

        $freeze = $this->asUser($auditor)->postJson(
            "/api/v1/audit-management/engagements/{$engagement->id}/samples/extract",
            [
                'source_module' => 'procurement',
                'method' => 'random',
                'sample_size' => 2,
                'population_ids' => [101, 102, 103, 104],
                'population_description' => 'FY2026 POs over 10k',
            ]
        );
        $freeze->assertCreated();
        $sampleId = $freeze->json('data.id');
        $this->assertTrue((bool) $freeze->json('data.is_frozen'));
        $this->assertSame([101, 102, 103, 104], $freeze->json('data.frozen_population'));

        $this->asUser($auditor)->postJson("/api/v1/audit-management/samples/{$sampleId}/adjust", [
            'sample_ids' => [101, 103],
        ])->assertUnprocessable()->assertJsonValidationErrors(['justification']);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/samples/{$sampleId}/adjust", [
            'sample_ids' => [101, 103],
            'justification' => 'Exclude cancelled POs after freeze review',
        ])->assertOk()
            ->assertJsonPath('data.sample_ids.0', 101)
            ->assertJsonPath('data.adjustment_justification', 'Exclude cancelled POs after freeze review');

        $sample = AuditSample::findOrFail($sampleId);
        $this->assertSame([101, 102, 103, 104], $sample->frozen_population);
        $this->assertTrue($sample->is_frozen);
    }

    public function test_external_workspace_auto_revokes_when_window_ends(): void
    {
        [, $auditor] = $this->asInternalAuditor();

        $create = $this->asUser($auditor)->postJson('/api/v1/audit-management/external', [
            'title' => 'External FY26',
            'auditor_firm' => 'Demo Firm',
            'access_starts_at' => now()->subDays(10)->toDateString(),
            'access_ends_at' => now()->subDay()->toDateString(),
            'watermark_required' => true,
            'evidence_room_enabled' => true,
        ]);
        $create->assertCreated();
        $id = $create->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/external/{$id}/activate")->assertOk();

        $this->asUser($auditor)->postJson("/api/v1/audit-management/external/{$id}/auto-revoke-check")
            ->assertOk()
            ->assertJsonPath('data.access_active', false)
            ->assertJsonPath('data.status', 'closed');

        $eng = AuditExternalEngagement::findOrFail($id);
        $this->assertFalse($eng->access_active);
        $this->assertFalse($eng->isAccessWindowOpen());
    }

    public function test_external_evidence_download_is_logged_with_watermark_flag(): void
    {
        [, $auditor] = $this->asInternalAuditor();

        $id = $this->asUser($auditor)->postJson('/api/v1/audit-management/external', [
            'title' => 'Evidence room',
            'auditor_firm' => 'Firm',
            'access_starts_at' => now()->subDay()->toDateString(),
            'access_ends_at' => now()->addDays(5)->toDateString(),
            'watermark_required' => true,
            'evidence_room_enabled' => true,
        ])->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/external/{$id}/activate")->assertOk();

        $dl = $this->asUser($auditor)->postJson("/api/v1/audit-management/external/{$id}/evidence-downloads", [
            'document_label' => 'Bank confirmations.zip',
            'document_path' => 'external/bank-confirmations.zip',
        ]);
        $dl->assertCreated();
        $this->assertTrue((bool) $dl->json('data.watermark_applied'));
        $this->assertDatabaseHas('audit_external_evidence_downloads', [
            'external_engagement_id' => $id,
            'document_label' => 'Bank confirmations.zip',
            'watermark_applied' => true,
        ]);
    }

    public function test_external_appointment_tracking_stores_plenary_term_and_independence(): void
    {
        [, $auditor] = $this->asInternalAuditor();

        $res = $this->asUser($auditor)->postJson('/api/v1/audit-management/appointments', [
            'firm_name' => 'Acme External Auditors',
            'plenary_resolution_ref' => 'PLENARY/2026/14',
            'appointed_on' => '2026-03-01',
            'term_starts_on' => '2026-04-01',
            'term_ends_on' => '2029-03-31',
            'independence_docs_on_file' => true,
            'notes' => 'Procurement owns tender; Audit stores appointment result.',
        ]);
        $res->assertCreated();
        $id = $res->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/appointments/{$id}/renewals", [
            'renewed_on' => '2029-02-15',
            'term_starts_on' => '2029-04-01',
            'term_ends_on' => '2032-03-31',
            'notes' => 'Renewed by Plenary',
        ])->assertCreated();

        $appointment = AuditExternalAppointment::findOrFail($id)->fresh();
        $this->assertSame('Acme External Auditors', $appointment->firm_name);
        $this->assertSame('PLENARY/2026/14', $appointment->plenary_resolution_ref);
        $this->assertIsArray($appointment->renewals);
        $this->assertCount(1, $appointment->renewals);
    }

    public function test_ai_suggestions_require_human_confirm_and_cannot_issue_or_close(): void
    {
        config(['audit.ai_provider' => 'stub']);

        [, $auditor] = $this->asInternalAuditor();
        $engagement = $this->seedEngagement($auditor);

        $findingId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'Weak imprest controls',
            'rating' => 'high',
            'cause' => 'Procedure gap',
        ])->json('data.id');

        $suggest = $this->asUser($auditor)->postJson('/api/v1/audit-management/ai/suggestions', [
            'kind' => 'duplicate_findings',
            'engagement_id' => $engagement->id,
            'context' => ['finding_id' => $findingId],
        ]);
        $suggest->assertCreated();
        $suggestionId = $suggest->json('data.id');
        $this->assertSame('pending_confirmation', $suggest->json('data.status'));
        $this->assertFalse((bool) $suggest->json('data.auto_applied'));

        // Forbidden kinds / actions must be rejected by the AI service.
        $this->asUser($auditor)->postJson('/api/v1/audit-management/ai/suggestions', [
            'kind' => 'issue_finding',
            'engagement_id' => $engagement->id,
        ])->assertUnprocessable()->assertJsonValidationErrors(['kind']);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/ai/suggestions/{$suggestionId}/apply", [
            'action' => 'issue_finding',
        ])->assertUnprocessable()->assertJsonValidationErrors(['action']);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/ai/suggestions/{$suggestionId}/apply", [
            'action' => 'close_finding',
        ])->assertUnprocessable()->assertJsonValidationErrors(['action']);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/ai/suggestions/{$suggestionId}/apply", [
            'action' => 'verify_implementation',
        ])->assertUnprocessable()->assertJsonValidationErrors(['action']);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/ai/suggestions/{$suggestionId}/apply", [
            'action' => 'approve_management_response',
        ])->assertUnprocessable()->assertJsonValidationErrors(['action']);

        // Human confirm of a safe draft annotation only.
        $apply = $this->asUser($auditor)->postJson("/api/v1/audit-management/ai/suggestions/{$suggestionId}/apply", [
            'action' => 'attach_note',
            'confirmed' => true,
            'note' => 'Auditor reviewed possible duplicate.',
        ]);
        $apply->assertOk();
        $this->assertSame('applied', AuditAiSuggestion::findOrFail($suggestionId)->status);

        $finding = AuditFinding::findOrFail($findingId);
        $this->assertNotSame('issued', $finding->status);
        $this->assertNotSame('closed', $finding->status);

        /** @var AuditAiAssistService $ai */
        $ai = app(AuditAiAssistService::class);
        $this->assertFalse($ai->canAutoIssueFindings());
        $this->assertFalse($ai->canAutoCloseFindings());
        $this->assertFalse($ai->canAutoVerifyImplementation());
        $this->assertFalse($ai->canAssignBlame());
        $this->assertFalse($ai->canModifyFinalConclusions());
    }

    public function test_analytics_dashboard_returns_engagement_metrics(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        $this->seedEngagement($auditor);

        $res = $this->asUser($auditor)->getJson('/api/v1/audit-management/analytics');
        $res->assertOk();
        $data = $res->json('data');
        $this->assertArrayHasKey('cycle_time_days_avg', $data);
        $this->assertArrayHasKey('rating_distribution', $data);
        $this->assertArrayHasKey('overdue_corrective_rate', $data);
        $this->assertArrayHasKey('plan_completion_pct', $data);
    }

    public function test_governance_pack_export_includes_critical_high_findings(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        $engagement = $this->seedEngagement($auditor);

        $findingId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'Critical control failure',
            'rating' => 'critical',
        ])->json('data.id');
        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$findingId}/issue")->assertOk();

        $pack = $this->asUser($auditor)->postJson('/api/v1/audit-management/governance-packs', [
            'title' => 'FSC Pack Q3',
            'fiscal_year' => 2026,
        ]);
        $pack->assertCreated();
        $this->assertNotEmpty($pack->json('data.payload.critical_high_findings'));
        $this->assertSame('Critical control failure', $pack->json('data.payload.critical_high_findings.0.title'));
    }
}
