<?php

namespace Tests\Feature\MAndE;

use App\Models\Indicator;
use App\Models\StrategicGoal;
use App\Models\StrategicPlan;
use App\Models\Tenant;
use Tests\TestCase;

class StrategicPlanTest extends TestCase
{
    public function test_unauthenticated_cannot_list_plans(): void
    {
        $this->getJson('/api/v1/mande/strategic-plans')->assertUnauthorized();
    }

    public function test_admin_can_create_strategic_plan(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/mande/strategic-plans', [
            'name'       => 'SADC PF Strategic Plan 2024-2029',
            'period'     => '2024-2029',
            'start_date' => '2024-01-01',
            'end_date'   => '2029-12-31',
        ])->assertCreated()
          ->assertJsonPath('data.name', 'SADC PF Strategic Plan 2024-2029');

        $this->assertDatabaseHas('strategic_plans', ['period' => '2024-2029']);
    }

    public function test_plan_requires_name(): void
    {
        [$http] = $this->asAdmin();
        $http->postJson('/api/v1/mande/strategic-plans', ['period' => '2024-2029'])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name']);
    }

    public function test_staff_without_admin_cannot_create_plan(): void
    {
        [$http] = $this->asStaff();
        $http->postJson('/api/v1/mande/strategic-plans', ['name' => 'X'])
             ->assertForbidden();
    }

    public function test_admin_can_add_nested_goal(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $plan = StrategicPlan::create([
            'tenant_id' => $tenant->id, 'name' => 'Plan', 'status' => 'draft', 'created_by' => $user->id,
        ]);

        $http->postJson("/api/v1/mande/strategic-plans/{$plan->id}/goals", [
            'title' => 'Goal 1 — Strengthen Democracy',
            'code'  => 'G1',
        ])->assertCreated()
          ->assertJsonPath('data.title', 'Goal 1 — Strengthen Democracy');

        $this->assertDatabaseHas('strategic_goals', ['strategic_plan_id' => $plan->id, 'code' => 'G1']);
    }

    public function test_archiving_plan_preserves_goals_and_links(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $plan = StrategicPlan::create([
            'tenant_id' => $tenant->id, 'name' => 'Plan', 'status' => 'active', 'created_by' => $user->id,
        ]);
        $goal = StrategicGoal::create([
            'tenant_id' => $tenant->id, 'strategic_plan_id' => $plan->id, 'title' => 'Goal',
        ]);

        $http->postJson("/api/v1/mande/strategic-plans/{$plan->id}/archive")
             ->assertOk()
             ->assertJsonPath('data.status', 'archived');

        // Historical child records must be retained, not deleted.
        $this->assertDatabaseHas('strategic_goals', ['id' => $goal->id, 'deleted_at' => null]);
    }

    public function test_cannot_edit_archived_plan(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $plan = StrategicPlan::create([
            'tenant_id' => $tenant->id, 'name' => 'Plan', 'status' => 'archived', 'created_by' => $user->id,
        ]);

        $http->putJson("/api/v1/mande/strategic-plans/{$plan->id}", ['name' => 'New'])
             ->assertStatus(422);
    }

    public function test_show_returns_nested_tree(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $plan = StrategicPlan::create([
            'tenant_id' => $tenant->id, 'name' => 'Plan', 'status' => 'active', 'created_by' => $user->id,
        ]);
        StrategicGoal::create([
            'tenant_id' => $tenant->id, 'strategic_plan_id' => $plan->id, 'title' => 'Goal',
        ]);

        $http->getJson("/api/v1/mande/strategic-plans/{$plan->id}")
             ->assertOk()
             ->assertJsonPath('data.goals.0.title', 'Goal');
    }
}
