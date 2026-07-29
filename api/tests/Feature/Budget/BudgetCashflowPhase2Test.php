<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\CashflowInflow;
use App\Models\CashflowScenario;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\Tenant;
use Carbon\Carbon;
use Tests\TestCase;

class BudgetCashflowPhase2Test extends TestCase
{
    private function seedLine(Tenant $tenant, float $allocated = 100000): array
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $source = FundingSource::create([
            'tenant_id' => $tenant->id,
            'code' => 'CF2-'.substr(uniqid(), -4),
            'name' => 'Member Funds',
            'type' => 'member_contributions',
            'currency' => 'NAD',
            'is_active' => true,
        ]);
        $dept = $this->makeDepartment($tenant);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'FY 2026/27 Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $allocated,
            'created_by' => $finance->id,
        ]);
        $line = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'CF2-LINE-'.substr(uniqid(), -4),
            'name' => 'Cashflow Ops',
            'funding_source_id' => $source->id,
            'department_id' => $dept->id,
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ]);

        return compact('finance', 'fy', 'source', 'dept', 'budget', 'line');
    }

    public function test_structured_membership_inflows_appear_in_forecast(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'source' => $source] = $this->seedLine($tenant);

        $this->asUser($finance)
            ->postJson('/api/v1/budget/cashflow/inflows', [
                'financial_year_id' => $fy->id,
                'source_type' => 'membership',
                'label' => 'Q1 Member Contributions',
                'counterparty_name' => 'Member States',
                'period' => '2026-07',
                'amount' => 50000,
                'currency' => 'NAD',
                'status' => 'planned',
                'funding_source_id' => $source->id,
            ])
            ->assertCreated()
            ->assertJsonPath('data.source_type', 'membership')
            ->assertJsonPath('data.amount', 50000);

        $forecast = $this->asUser($finance)
            ->getJson('/api/v1/budget/cashflow/forecast?financial_year_id='.$fy->id)
            ->assertOk();

        $jul = collect($forecast->json('data.periods'))->firstWhere('period', '2026-07');
        $this->assertNotNull($jul);
        $this->assertSame(50000.0, (float) $jul['structured_inflow']);
        $this->assertSame(50000.0, (float) $jul['net']);
        $this->assertSame(50000.0, (float) $forecast->json('data.totals.structured_inflow'));
    }

    public function test_scenario_compare_returns_side_by_side_periods(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy] = $this->seedLine($tenant);

        $base = CashflowScenario::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'name' => 'Base',
            'kind' => 'base',
            'opening_balance' => 100000,
            'currency' => 'NAD',
            'status' => 'active',
            'created_by' => $finance->id,
        ]);
        $opt = CashflowScenario::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'name' => 'Optimistic',
            'kind' => 'optimistic',
            'opening_balance' => 120000,
            'currency' => 'NAD',
            'status' => 'active',
            'created_by' => $finance->id,
        ]);
        $base->adjustments()->create([
            'period' => '2026-07',
            'direction' => 'inflow',
            'amount' => 10000,
            'label' => 'Base inflow',
            'category' => 'manual',
        ]);
        $opt->adjustments()->create([
            'period' => '2026-07',
            'direction' => 'inflow',
            'amount' => 30000,
            'label' => 'Optimistic inflow',
            'category' => 'manual',
        ]);

        $compare = $this->asUser($finance)
            ->getJson('/api/v1/budget/cashflow/compare?'.http_build_query([
                'financial_year_id' => $fy->id,
                'scenario_ids' => [$base->id, $opt->id],
            ]))
            ->assertOk()
            ->json('data');

        $this->assertCount(2, $compare['scenarios']);
        $this->assertNotEmpty($compare['periods']);
        $jul = collect($compare['periods'])->firstWhere('period', '2026-07');
        $this->assertNotNull($jul);
        $this->assertSame(10000.0, (float) $jul['scenarios'][(string) $base->id]['scenario_inflow']);
        $this->assertSame(30000.0, (float) $jul['scenarios'][(string) $opt->id]['scenario_inflow']);
        $this->assertSame(110000.0, (float) $jul['scenarios'][(string) $base->id]['closing_balance']);
        $this->assertSame(150000.0, (float) $jul['scenarios'][(string) $opt->id]['closing_balance']);
    }

    public function test_forecast_csv_export_includes_headers_and_structured_inflow(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy] = $this->seedLine($tenant);

        CashflowInflow::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'source_type' => 'donor',
            'label' => 'Donor tranche',
            'period' => '2026-08',
            'amount' => 25000,
            'currency' => 'NAD',
            'status' => 'confirmed',
            'created_by' => $finance->id,
        ]);

        $csv = $this->asUser($finance)
            ->get('/api/v1/budget/cashflow/forecast/export?financial_year_id='.$fy->id)
            ->assertOk()
            ->assertHeader('content-type', 'text/csv; charset=UTF-8')
            ->getContent();

        $this->assertStringContainsString('period,structured_inflow,scenario_inflow,actual_outflow,projected_outflow,scenario_outflow,net,closing_balance', $csv);
        $this->assertStringContainsString('2026-08,25000', $csv);
    }

    public function test_compare_csv_export_lists_scenario_columns(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy] = $this->seedLine($tenant);

        $a = CashflowScenario::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'name' => 'A',
            'kind' => 'base',
            'opening_balance' => 0,
            'currency' => 'NAD',
            'status' => 'active',
            'created_by' => $finance->id,
        ]);
        $b = CashflowScenario::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'name' => 'B',
            'kind' => 'pessimistic',
            'opening_balance' => 0,
            'currency' => 'NAD',
            'status' => 'active',
            'created_by' => $finance->id,
        ]);

        $csv = $this->asUser($finance)
            ->get('/api/v1/budget/cashflow/compare/export?'.http_build_query([
                'financial_year_id' => $fy->id,
                'scenario_ids' => [$a->id, $b->id],
            ]))
            ->assertOk()
            ->getContent();

        $this->assertStringContainsString('period', $csv);
        $this->assertStringContainsString('A_closing_balance', $csv);
        $this->assertStringContainsString('B_closing_balance', $csv);
    }

    public function test_cancelled_inflows_are_excluded_from_forecast(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy] = $this->seedLine($tenant);

        CashflowInflow::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'source_type' => 'membership',
            'label' => 'Cancelled',
            'period' => '2026-07',
            'amount' => 99999,
            'currency' => 'NAD',
            'status' => 'cancelled',
            'created_by' => $finance->id,
        ]);

        $jul = collect(
            $this->asUser($finance)
                ->getJson('/api/v1/budget/cashflow/forecast?financial_year_id='.$fy->id)
                ->assertOk()
                ->json('data.periods')
        )->firstWhere('period', '2026-07');

        $this->assertSame(0.0, (float) $jul['structured_inflow']);
    }
}
