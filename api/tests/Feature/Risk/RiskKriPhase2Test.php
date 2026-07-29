<?php

namespace Tests\Feature\Risk;

use App\Models\Assignment;
use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\BudgetVariance;
use App\Models\FinancialYear;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\Risk;
use App\Models\RiskKri;
use App\Models\StockCategory;
use App\Models\StockItem;
use App\Models\StrategicGoal;
use App\Models\StrategicObjective;
use App\Models\StrategicPlan;
use App\Models\Tenant;
use App\Modules\Risk\Services\RiskKriService;
use Tests\TestCase;

class RiskKriPhase2Test extends TestCase
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

    public function test_default_kris_are_seeded_and_catalog_documents_sources(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage']);

        $this->asUser($admin)
            ->getJson('/api/v1/risk/kris')
            ->assertOk()
            ->assertJsonCount(5, 'data')
            ->assertJsonFragment(['code' => 'BUDGET_VARIANCE_PCT'])
            ->assertJsonFragment(['code' => 'OVERDUE_ASSIGNMENTS'])
            ->assertJsonFragment(['code' => 'LEAVE_APPROVAL_BACKLOG'])
            ->assertJsonFragment(['code' => 'STOCK_STOCKOUTS'])
            ->assertJsonFragment(['code' => 'UNRESOLVED_HIGH_RISKS']);

        $catalog = $this->asUser($admin)
            ->getJson('/api/v1/risk/kris/catalog')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($catalog);
        $codes = collect($catalog)->pluck('code')->all();
        $this->assertContains('BUDGET_VARIANCE_PCT', $codes);
        $budget = collect($catalog)->firstWhere('code', 'BUDGET_VARIANCE_PCT');
        $this->assertStringContainsString('budget_variances', $budget['data_source']);
    }

    public function test_threshold_evaluation_detects_warning_and_breach(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $service = app(RiskKriService::class);
        $service->ensureDefaults($tenant->id);

        $kri = RiskKri::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'UNRESOLVED_HIGH_RISKS')
            ->firstOrFail();

        $kri->update([
            'warning_threshold' => 1,
            'breach_threshold' => 3,
        ]);

        // No high risks → ok
        $reading = $service->evaluateKri($kri);
        $this->assertSame('ok', $reading->status);
        $this->assertSame(0.0, (float) $reading->value);

        $objective = $this->makeObjective($tenant->id);
        // Score 12 => high; score 16 => critical (Risk::computeRiskLevel).
        Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'High A',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 3,
            'impact' => 4,
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);
        Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'Critical B',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 4,
            'impact' => 4,
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);

        $kri->refresh();
        $warning = $service->evaluateKri($kri);
        $this->assertSame('warning', $warning->status);
        $this->assertSame(2.0, (float) $warning->value);

        Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'High C',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 3,
            'impact' => 4,
            'status' => 'submitted',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);

        $kri->refresh();
        $breach = $service->evaluateKri($kri);
        $this->assertSame('breach', $breach->status);
        $this->assertSame(3.0, (float) $breach->value);
    }

    public function test_cross_module_collectors_and_breach_notification(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage', 'risk.admin']);
        $this->makeGovernanceOfficer($tenant);

        $service = app(RiskKriService::class);
        $service->ensureDefaults($tenant->id);

        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => 1000,
            'created_by' => $admin->id,
        ]);
        $line = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'KRI-001',
            'name' => 'Ops',
            'category' => 'operational',
            'amount_allocated' => 1000,
            'original_allocation' => 1000,
            'amount_spent' => 1300,
            'is_active' => true,
        ]);

        BudgetVariance::create([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'financial_year_id' => $fy->id,
            'period_type' => 'ytd',
            'period_key' => '2026',
            'as_of_date' => now()->toDateString(),
            'approved_budget' => 1000,
            'actual_expenditure' => 1300,
            'open_commitments' => 0,
            'available_budget' => -300,
            'variance_amount' => -300,
            'variance_pct' => 30,
            'utilisation_pct' => 130,
            'is_significant' => true,
            'status' => 'open',
        ]);

        Assignment::create([
            'tenant_id' => $tenant->id,
            'title' => 'Overdue treatment',
            'description' => 'Overdue risk treatment',
            'status' => 'active',
            'due_date' => now()->subDays(5)->toDateString(),
            'created_by' => $admin->id,
            'source_type' => 'risk',
            'priority' => 'high',
        ]);

        LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $admin->id,
            'reference_number' => 'LV-KRI-'.uniqid(),
            'leave_type' => 'annual',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(),
            'days_requested' => 3,
            'reason' => 'Pending too long',
            'status' => 'submitted',
            'submitted_at' => now()->subDays(10),
        ]);

        $category = StockCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Stationery',
            'code' => 'sta-'.substr(uniqid(), -6),
        ]);
        StockItem::create([
            'tenant_id' => $tenant->id,
            'stock_category_id' => $category->id,
            'item_code' => 'STK-'.uniqid(),
            'name' => 'Paper',
            'unit' => 'ream',
            'current_balance' => 0,
            'reorder_level' => 5,
            'status' => 'active',
        ]);

        $response = $this->asUser($admin)
            ->postJson('/api/v1/risk/kris/evaluate')
            ->assertOk()
            ->json('data');

        $byCode = collect($response)->keyBy('code');
        $this->assertGreaterThanOrEqual(30, (float) $byCode['BUDGET_VARIANCE_PCT']['last_value']);
        $this->assertSame('breach', $byCode['BUDGET_VARIANCE_PCT']['last_status']);
        $this->assertGreaterThanOrEqual(1, (float) $byCode['OVERDUE_ASSIGNMENTS']['last_value']);
        $this->assertGreaterThanOrEqual(1, (float) $byCode['LEAVE_APPROVAL_BACKLOG']['last_value']);
        $this->assertGreaterThanOrEqual(1, (float) $byCode['STOCK_STOCKOUTS']['last_value']);

        $this->assertTrue(
            Notification::query()
                ->where('tenant_id', $tenant->id)
                ->where('trigger', 'risk.kri_breached')
                ->exists()
        );
    }

    public function test_kri_can_link_to_risk_and_objective(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->givePermissionTo(['risk.view', 'risk.manage']);
        $objective = $this->makeObjective($tenant->id);

        $risk = Risk::create([
            'tenant_id' => $tenant->id,
            'submitted_by' => $admin->id,
            'title' => 'Budget overrun risk',
            'description' => 'Desc',
            'category' => 'financial',
            'likelihood' => 3,
            'impact' => 4,
            'risk_level' => 'high',
            'status' => 'approved',
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $admin->id,
        ]);

        app(RiskKriService::class)->ensureDefaults($tenant->id);
        $kri = RiskKri::query()
            ->where('tenant_id', $tenant->id)
            ->where('code', 'BUDGET_VARIANCE_PCT')
            ->firstOrFail();

        $this->asUser($admin)
            ->patchJson('/api/v1/risk/kris/'.$kri->id, [
                'risk_id' => $risk->id,
                'strategic_objective_id' => $objective->id,
                'warning_threshold' => 15,
                'breach_threshold' => 25,
            ])
            ->assertOk()
            ->assertJsonPath('data.risk_id', $risk->id)
            ->assertJsonPath('data.strategic_objective_id', $objective->id)
            ->assertJsonPath('data.warning_threshold', 15);
    }
}
