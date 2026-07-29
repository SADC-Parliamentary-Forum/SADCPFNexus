<?php

namespace Tests\Feature\Risk;

use App\Models\AssetInsurancePolicy;
use App\Models\Risk;
use App\Models\StrategicGoal;
use App\Models\StrategicObjective;
use App\Models\StrategicPlan;
use App\Models\Tenant;
use Carbon\Carbon;
use Tests\TestCase;

class RiskBcpOpsTest extends TestCase
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

    public function test_can_create_and_complete_bcp_exercise(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage']);
        $objective = $this->makeObjective($tenant->id);
        $risk = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'BCP risk',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 3,
            'impact' => 3,
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);

        $exercise = $this->asUser($admin)
            ->postJson('/api/v1/risk/bcp-exercises', [
                'risk_id' => $risk->id,
                'title' => 'Fire drill Q3',
                'scheduled_at' => '2026-09-01T10:00:00Z',
                'exercise_type' => 'tabletop',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('planned', $exercise['status']);

        $done = $this->asUser($admin)
            ->postJson("/api/v1/risk/bcp-exercises/{$exercise['id']}/complete", [
                'result' => 'pass',
                'outcome_notes' => 'All clear',
                'completed_at' => '2026-09-01T12:00:00Z',
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('completed', $done['status']);
        $this->assertSame('pass', $done['result']);
    }

    public function test_insurance_renewal_extends_policy(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage', 'assets.view', 'assets.manage']);

        $policy = AssetInsurancePolicy::create([
            'tenant_id' => $tenant->id,
            'policy_number' => 'POL-'.uniqid(),
            'insurer_name' => 'Santam',
            'coverage_type' => 'motor',
            'effective_from' => '2025-01-01',
            'effective_to' => '2026-01-01',
            'status' => 'active',
            'currency' => 'NAD',
            'created_by' => $admin->id,
        ]);

        $renewed = $this->asUser($admin)
            ->postJson("/api/v1/assets-meta/insurance/policies/{$policy->id}/renew", [
                'effective_from' => '2026-01-02',
                'effective_to' => '2027-01-01',
                'premium_amount' => 12000,
            ])
            ->assertOk()
            ->json('data');

        $this->assertSame('2027-01-01', Carbon::parse($renewed['effective_to'])->toDateString());
        $this->assertSame('active', $renewed['status']);
        $this->assertSame('expired', $policy->fresh()->status);

        $due = $this->asUser($admin)
            ->getJson('/api/v1/risk/insurance-renewals?within_days=400')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($due);
    }
}
