<?php

namespace Tests\Feature\Risk;

use App\Models\Risk;
use App\Models\RiskControl;
use App\Models\RiskControlTestingCampaign;
use App\Models\RiskControlTestingItem;
use App\Models\StrategicGoal;
use App\Models\StrategicObjective;
use App\Models\StrategicPlan;
use App\Models\Tenant;
use App\Modules\Risk\Services\RiskControlTestingService;
use Tests\TestCase;

class RiskControlTestingPhase3Test extends TestCase
{
    private function makeObjective(int $tenantId): StrategicObjective
    {
        $plan = StrategicPlan::create([
            'tenant_id' => $tenantId,
            'name' => 'Plan '.uniqid(),
            'status' => 'active',
        ]);
        $goal = StrategicGoal::create([
            'tenant_id' => $tenantId,
            'strategic_plan_id' => $plan->id,
            'title' => 'Goal',
        ]);

        return StrategicObjective::create([
            'tenant_id' => $tenantId,
            'strategic_goal_id' => $goal->id,
            'title' => 'Objective',
            'code' => 'OBJ-'.uniqid(),
        ]);
    }

    public function test_campaign_create_and_complete_pass(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage']);

        $objective = $this->makeObjective($tenant->id);
        $risk = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'Risk under test',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 3,
            'impact' => 3,
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);

        $control = RiskControl::create([
            'tenant_id' => $tenant->id,
            'title' => 'Access review',
            'control_type' => 'detective',
            'created_by' => $admin->id,
            'control_owner_id' => $admin->id,
            'status' => 'active',
        ]);
        $control->risks()->attach($risk->id, [
            'effectiveness_rating' => 'partially_effective',
            'linked_by' => $admin->id,
            'created_at' => now(),
        ]);

        $create = $this->asUser($admin)->postJson('/api/v1/risk/control-testing/campaigns', [
            'title' => 'Q3 Control Tests',
            'scheduled_start' => now()->toDateString(),
            'scheduled_end' => now()->addDays(7)->toDateString(),
            'control_ids' => [$control->id],
        ]);
        $create->assertCreated();
        $campaignId = $create->json('data.id');
        $this->assertDatabaseHas('risk_control_testing_campaigns', [
            'id' => $campaignId,
            'tenant_id' => $tenant->id,
            'title' => 'Q3 Control Tests',
        ]);

        $item = RiskControlTestingItem::where('campaign_id', $campaignId)->firstOrFail();

        $complete = $this->asUser($admin)->postJson("/api/v1/risk/control-testing/items/{$item->id}/complete", [
            'result' => 'pass',
            'checklist_notes' => 'All checks OK',
            'evidence_notes' => 'Screenshot attached in notes',
        ]);
        $complete->assertOk()
            ->assertJsonPath('data.status', 'passed')
            ->assertJsonPath('data.result', 'pass');

        $this->assertSame('completed', RiskControlTestingCampaign::find($campaignId)->status);
    }

    public function test_overdue_detection_marks_pending_past_due(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage']);

        $control = RiskControl::create([
            'tenant_id' => $tenant->id,
            'title' => 'Backup restore test',
            'control_type' => 'corrective',
            'created_by' => $admin->id,
            'status' => 'active',
        ]);

        $campaign = RiskControlTestingCampaign::create([
            'tenant_id' => $tenant->id,
            'title' => 'Overdue campaign',
            'status' => 'in_progress',
            'created_by' => $admin->id,
            'owner_id' => $admin->id,
        ]);

        $item = RiskControlTestingItem::create([
            'tenant_id' => $tenant->id,
            'campaign_id' => $campaign->id,
            'control_id' => $control->id,
            'status' => 'pending',
            'due_at' => now()->subDays(2)->toDateString(),
        ]);

        $count = app(RiskControlTestingService::class)->markOverdueItems($tenant->id);
        $this->assertSame(1, $count);
        $this->assertSame('overdue', $item->fresh()->status);

        $this->asUser($admin)
            ->postJson('/api/v1/risk/control-testing/mark-overdue')
            ->assertOk()
            ->assertJsonPath('updated', 0);
    }

    public function test_bcp_and_dependency_linkage(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage']);
        $objective = $this->makeObjective($tenant->id);

        $riskA = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'Primary risk',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 2,
            'impact' => 3,
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);
        $riskB = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'Dependent risk',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 3,
            'impact' => 3,
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);

        $this->asUser($admin)->postJson('/api/v1/risk/bcp-links', [
            'risk_id' => $riskA->id,
            'link_type' => 'bcp_note',
            'title' => 'DR runbook section 4',
            'notes' => 'Failover within 4 hours',
        ])->assertCreated();

        $this->asUser($admin)->postJson('/api/v1/risk/dependencies', [
            'risk_id' => $riskA->id,
            'related_risk_id' => $riskB->id,
            'relation_type' => 'depends_on',
        ])->assertCreated();

        $this->asUser($admin)
            ->getJson('/api/v1/risk/dependencies?risk_id='.$riskA->id)
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }
}
