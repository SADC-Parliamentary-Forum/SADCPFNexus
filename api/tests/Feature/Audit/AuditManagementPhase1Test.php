<?php

namespace Tests\Feature\Audit;

use App\Models\Assignment;
use App\Models\AuditEngagement;
use App\Models\AuditFinding;
use App\Models\AuditIndependenceDeclaration;
use App\Models\AuditPlan;
use App\Models\AuditPlanVersion;
use App\Models\AuditReport;
use App\Models\AuditUniverseEntity;
use App\Models\Tenant;
use App\Models\User;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AuditManagementPhase1Test extends TestCase
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
            'status' => 'independence_pending',
            'lead_auditor_id' => $auditor->id,
            'created_by' => $auditor->id,
            'confidentiality_level' => 'restricted',
        ], $overrides));

        AuditIndependenceDeclaration::create([
            'tenant_id' => $auditor->tenant_id,
            'engagement_id' => $engagement->id,
            'user_id' => $auditor->id,
            'status' => 'pending',
        ]);

        return $engagement;
    }

    public function test_plan_versioning_and_amend_history(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $sg] = $this->asSG($auditor->tenant);

        $create = $this->asUser($auditor)->postJson('/api/v1/audit-management/plans', [
            'title' => 'FY2026 Internal Audit Plan',
            'fiscal_year' => 2026,
            'summary' => 'Coverage of finance and procurement',
        ]);
        $create->assertCreated();
        $planId = $create->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/plans/{$planId}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');

        $this->asUser($sg)->postJson("/api/v1/audit-management/plans/{$planId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/plans/{$planId}/amend", [
            'amendment_reason' => 'Add IT systems engagement',
            'summary' => 'Amended coverage',
        ])->assertOk()
            ->assertJsonPath('data.version', 2)
            ->assertJsonPath('data.status', 'amended');

        $this->assertGreaterThanOrEqual(2, AuditPlanVersion::where('audit_plan_id', $planId)->count());
    }

    public function test_independence_gate_blocks_fieldwork(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        $engagement = $this->seedEngagement($auditor);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/fieldwork")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['independence']);

        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/independence", [
            'status' => 'cleared',
            'declaration_text' => 'No conflicts.',
        ])->assertOk();

        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/fieldwork")
            ->assertOk()
            ->assertJsonPath('data.status', 'fieldwork');
    }

    public function test_management_cannot_edit_issued_finding_text(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $manager] = $this->asStaff($auditor->tenant);
        $engagement = $this->seedEngagement($auditor);
        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/independence", [
            'status' => 'cleared',
        ]);

        $findingRes = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'Weak imprest controls',
            'criterion' => 'Policy X',
            'condition_text' => 'Condition',
            'cause' => 'Cause',
            'effect' => 'Effect',
            'recommendation' => 'Strengthen controls',
            'rating' => 'high',
        ]);
        $findingRes->assertCreated();
        $findingId = $findingRes->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$findingId}/issue")->assertOk();

        $this->asUser($manager)->putJson("/api/v1/audit-management/findings/{$findingId}", [
            'title' => 'Trying to rewrite finding',
            'criterion' => 'Hacked',
        ])->assertUnprocessable();

        $this->asUser($manager)->postJson("/api/v1/audit-management/findings/{$findingId}/responses", [
            'response_text' => 'We disagree with the cause analysis.',
            'agrees' => false,
            'disagreement_notes' => 'Cause is incomplete.',
        ])->assertCreated();

        $finding = AuditFinding::findOrFail($findingId);
        $this->assertSame('Weak imprest controls', $finding->title);
        $this->assertSame('Policy X', $finding->criterion);
    }

    public function test_corrective_assignment_link_does_not_auto_close_finding(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $manager] = $this->asStaff($auditor->tenant);
        $engagement = $this->seedEngagement($auditor);
        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/independence", ['status' => 'cleared']);

        $findingId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'Procurement exception',
            'recommendation' => 'Close exception log monthly',
            'rating' => 'medium',
        ])->json('data.id');
        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$findingId}/issue")->assertOk();

        $ca = $this->asUser($manager)->postJson("/api/v1/audit-management/findings/{$findingId}/corrective-actions", [
            'title' => 'Monthly exception review',
            'owner_user_id' => $manager->id,
            'due_date' => now()->addDays(14)->toDateString(),
        ]);
        $ca->assertCreated();
        $actionId = $ca->json('data.id');
        $assignmentId = $ca->json('data.assignment_id');
        $this->assertNotNull($assignmentId);

        $assignment = Assignment::findOrFail($assignmentId);
        $this->assertSame('audit_finding', $assignment->source_type);

        // Mark complete via management path
        $this->asUser($manager)->postJson("/api/v1/audit-management/corrective-actions/{$actionId}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'due_for_verification');

        $finding = AuditFinding::findOrFail($findingId);
        $this->assertSame('due_for_verification', $finding->status);
        $this->assertNotSame('closed', $finding->status);
    }

    public function test_finding_sod_implementer_cannot_verify(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $manager] = $this->asStaff($auditor->tenant);
        // Grant verify so we exercise the implementer SoD rule (not only permission denial).
        $manager->givePermissionTo('audit.corrective.verify');

        $engagement = $this->seedEngagement($auditor);
        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/independence", ['status' => 'cleared']);

        $findingId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'SoD finding',
            'recommendation' => 'Fix it',
        ])->json('data.id');
        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$findingId}/issue");

        $actionId = $this->asUser($manager)->postJson("/api/v1/audit-management/findings/{$findingId}/corrective-actions", [
            'title' => 'Implement fix',
            'owner_user_id' => $manager->id,
        ])->json('data.id');

        $this->asUser($manager)->postJson("/api/v1/audit-management/corrective-actions/{$actionId}/complete")->assertOk();

        // Manager who implemented cannot verify even with verify permission
        $this->asUser($manager)->postJson("/api/v1/audit-management/corrective-actions/{$actionId}/verify", [
            'outcome' => 'verified_closed',
        ])->assertUnprocessable()->assertJsonValidationErrors(['sod']);

        // Auditor can verify
        $this->asUser($auditor)->postJson("/api/v1/audit-management/corrective-actions/{$actionId}/verify", [
            'outcome' => 'verified_closed',
            'notes' => 'Evidence adequate',
        ])->assertCreated();

        $this->assertSame('closed', AuditFinding::findOrFail($findingId)->status);
    }

    public function test_final_report_immutability(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        $engagement = $this->seedEngagement($auditor);

        $reportId = $this->asUser($auditor)->postJson('/api/v1/audit-management/reports', [
            'engagement_id' => $engagement->id,
            'title' => 'Draft report',
            'body' => 'Draft body',
        ])->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/reports/{$reportId}/issue")->assertOk();

        $this->asUser($auditor)->putJson("/api/v1/audit-management/reports/{$reportId}", [
            'body' => 'Tamper attempt',
        ])->assertUnprocessable();

        $report = AuditReport::findOrFail($reportId);
        $this->assertTrue($report->is_immutable);
        $this->assertSame('Draft body', $report->body);
    }

    public function test_confidentiality_redacts_search_for_non_cleared_users(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $manager] = $this->asStaff($auditor->tenant);
        $engagement = $this->seedEngagement($auditor);

        $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'Secret payroll anomaly',
            'confidentiality_level' => 'confidential',
            'condition_text' => 'Sensitive detail',
        ])->assertCreated();

        // Staff without confidential.view should not see confidential rows in search
        $list = $this->asUser($manager)->getJson('/api/v1/audit-management/findings?search=Secret');
        $list->assertOk();
        $titles = collect($list->json('data') ?? $list->json('data.data') ?? [])->pluck('title');
        // paginator shape: data.data
        $rows = $list->json('data') ?? [];
        if (isset($rows['data'])) {
            $rows = $rows['data'];
        }
        foreach ($rows as $row) {
            $this->assertNotSame('Secret payroll anomaly', $row['title'] ?? null);
            $this->assertSame([], $row['corrective_actions'] ?? []);
        }

        $listAll = $this->asUser($manager)->getJson('/api/v1/audit-management/findings?per_page=50');
        $listAll->assertOk();
        $allRows = $listAll->json('data') ?? [];
        if (isset($allRows['data'])) {
            $allRows = $allRows['data'];
        }
        $restricted = collect($allRows)->firstWhere('title', '[Restricted]');
        $this->assertNotNull($restricted);
        $this->assertSame([], $restricted['corrective_actions'] ?? []);

        $id = AuditFinding::where('tenant_id', $auditor->tenant_id)->where('confidentiality_level', 'confidential')->value('id');
        $this->asUser($manager)->getJson("/api/v1/audit-management/findings/{$id}")->assertNotFound();
    }

    public function test_universe_crud_basics(): void
    {
        [, $auditor] = $this->asInternalAuditor();

        $res = $this->asUser($auditor)->postJson('/api/v1/audit-management/universe', [
            'name' => 'Payroll process',
            'entity_type' => 'process',
            'risk_profile' => 'high',
        ]);
        $res->assertCreated();
        $id = $res->json('data.id');

        $this->asUser($auditor)->putJson("/api/v1/audit-management/universe/{$id}", [
            'status' => 'active',
            'description' => 'Core payroll',
        ])->assertOk();

        $this->assertDatabaseHas('audit_universe_entities', [
            'id' => $id,
            'name' => 'Payroll process',
        ]);
        $this->assertInstanceOf(AuditUniverseEntity::class, AuditUniverseEntity::find($id));
    }

    public function test_auditor_cannot_mark_corrective_complete(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $manager] = $this->asStaff($auditor->tenant);
        $engagement = $this->seedEngagement($auditor);
        $this->asUser($auditor)->postJson("/api/v1/audit-management/engagements/{$engagement->id}/independence", ['status' => 'cleared']);

        $findingId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'SoD implement',
        ])->json('data.id');
        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$findingId}/issue");

        $actionId = $this->asUser($manager)->postJson("/api/v1/audit-management/findings/{$findingId}/corrective-actions", [
            'title' => 'Action',
            'owner_user_id' => $manager->id,
        ])->json('data.id');

        $this->asUser($auditor)->postJson("/api/v1/audit-management/corrective-actions/{$actionId}/complete")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['sod']);
    }

    public function test_findings_list_filters_comma_separated_status_and_includes_corrective_actions(): void
    {
        [, $auditor] = $this->asInternalAuditor();
        [, $manager] = $this->asStaff($auditor->tenant);
        $engagement = $this->seedEngagement($auditor);

        $openId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'Open finding',
        ])->json('data.id');
        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$openId}/issue")->assertOk();

        $caFindingId = $this->asUser($auditor)->postJson('/api/v1/audit-management/findings', [
            'engagement_id' => $engagement->id,
            'title' => 'CA finding',
        ])->json('data.id');
        $this->asUser($auditor)->postJson("/api/v1/audit-management/findings/{$caFindingId}/issue")->assertOk();
        $this->asUser($manager)->postJson("/api/v1/audit-management/findings/{$caFindingId}/corrective-actions", [
            'title' => 'Fix control',
            'owner_user_id' => $manager->id,
        ])->assertCreated();

        $list = $this->asUser($auditor)->getJson(
            '/api/v1/audit-management/findings?status=corrective_in_progress,due_for_verification,reopened&per_page=50'
        )->assertOk();

        $rows = $list->json('data') ?? [];
        if (isset($rows['data'])) {
            $rows = $rows['data'];
        }
        $titles = collect($rows)->pluck('title');
        $this->assertTrue($titles->contains('CA finding'));
        $this->assertFalse($titles->contains('Open finding'));
        $caRow = collect($rows)->firstWhere('title', 'CA finding');
        $this->assertNotEmpty($caRow['corrective_actions'] ?? []);
    }
}
