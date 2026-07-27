<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\CashflowScenario;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\ImprestRequest;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Modules\Budget\Services\BudgetActualService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Carbon\Carbon;
use Tests\TestCase;

class BudgetCashflowScenarioTest extends TestCase
{
    private function seedLine(Tenant $tenant, float $allocated = 100000, array $overrides = []): array
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $source = FundingSource::create([
            'tenant_id' => $tenant->id,
            'code' => 'CF-'.substr(uniqid(), -4),
            'name' => 'Own Funds',
            'type' => 'own_funds',
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
        $line = BudgetLine::create(array_merge([
            'budget_id' => $budget->id,
            'code' => 'CF-LINE-'.substr(uniqid(), -4),
            'name' => 'Cashflow Ops',
            'funding_source_id' => $source->id,
            'department_id' => $dept->id,
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ], $overrides));

        return compact('finance', 'fy', 'source', 'dept', 'budget', 'line');
    }

    public function test_forecast_buckets_actuals_and_projected_commitments_by_month(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');

        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'line' => $line] = $this->seedLine($tenant, 200000);

        app(BudgetActualService::class)->post([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'accounting_reference' => 'CF-ACT-MAY',
            'transaction_date' => '2026-05-10',
            'amount' => 25000,
            'currency' => 'NAD',
        ], $finance);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $finance->id,
            'departure_date' => '2026-08-20',
            'return_date' => '2026-08-25',
            'status' => 'approved',
        ]);

        $commitment = app(BudgetCommitmentService::class)->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 40000,
            'source_type' => 'travel',
            'source_id' => $travel->id,
            'source_key' => 'TRAVEL:'.$travel->id,
            'travel_request_id' => $travel->id,
            'currency' => 'NAD',
        ], $finance);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/cashflow/forecast?'.http_build_query([
                'financial_year_id' => $fy->id,
            ]))
            ->assertOk()
            ->assertJsonPath('success', true);

        $periods = collect($response->json('data.periods'));
        $this->assertTrue($periods->isNotEmpty());
        $this->assertSame('2026-04', $periods->first()['period']);
        $this->assertSame('2027-03', $periods->last()['period']);

        $may = $periods->firstWhere('period', '2026-05');
        $aug = $periods->firstWhere('period', '2026-08');
        $this->assertNotNull($may);
        $this->assertNotNull($aug);
        $this->assertSame(25000.0, (float) $may['actual_outflow']);
        $this->assertSame(40000.0, (float) $aug['projected_outflow']);

        $items = collect($response->json('data.items'));
        $item = $items->firstWhere('budget_reservation_id', $commitment->id);
        $this->assertNotNull($item);
        $this->assertSame('2026-08-20', substr((string) $item['expected_cash_date'], 0, 10));
        $this->assertSame('2026-08', $item['period']);
    }

    public function test_forecast_falls_back_to_reserved_at_when_no_module_date(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');

        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'line' => $line] = $this->seedLine($tenant, 100000);

        $commitment = app(BudgetCommitmentService::class)->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 15000,
            'source_type' => 'manual',
            'source_id' => 99,
            'source_key' => 'MANUAL:CF-99',
            'currency' => 'NAD',
            'confirm' => false,
        ], $finance);

        BudgetReservation::whereKey($commitment->id)->update([
            'reserved_at' => '2026-09-05 08:00:00',
            'confirmed_at' => null,
            'created_at' => '2026-09-05 08:00:00',
        ]);

        $response = $this->asUser($finance)
            ->getJson('/api/v1/budget/cashflow/forecast?financial_year_id='.$fy->id)
            ->assertOk();

        $sep = collect($response->json('data.periods'))->firstWhere('period', '2026-09');
        $this->assertNotNull($sep);
        $this->assertSame(15000.0, (float) $sep['projected_outflow']);
    }

    public function test_scenario_opening_and_adjustments_affect_running_balance(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');

        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'line' => $line] = $this->seedLine($tenant, 100000);

        app(BudgetActualService::class)->post([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'accounting_reference' => 'CF-ACT-JUN',
            'transaction_date' => '2026-06-01',
            'amount' => 10000,
            'currency' => 'NAD',
        ], $finance);

        $create = $this->asUser($finance)
            ->postJson('/api/v1/budget/cashflow/scenarios', [
                'financial_year_id' => $fy->id,
                'name' => 'Base liquidity',
                'kind' => 'base',
                'opening_balance' => 100000,
                'currency' => 'NAD',
                'status' => 'active',
            ])
            ->assertCreated()
            ->assertJsonPath('success', true);

        $scenarioId = (int) $create->json('data.id');

        $this->asUser($finance)
            ->postJson("/api/v1/budget/cashflow/scenarios/{$scenarioId}/adjustments", [
                'period' => '2026-07',
                'direction' => 'inflow',
                'amount' => 20000,
                'label' => 'Member contribution',
            ])
            ->assertCreated();

        $this->asUser($finance)
            ->postJson("/api/v1/budget/cashflow/scenarios/{$scenarioId}/adjustments", [
                'period' => '2026-07',
                'direction' => 'outflow',
                'amount' => 5000,
                'label' => 'Extra contingency spend',
            ])
            ->assertCreated();

        $forecast = $this->asUser($finance)
            ->getJson('/api/v1/budget/cashflow/forecast?'.http_build_query([
                'financial_year_id' => $fy->id,
                'scenario_id' => $scenarioId,
            ]))
            ->assertOk();

        $this->assertSame(100000.0, (float) $forecast->json('data.opening_balance'));
        $periods = collect($forecast->json('data.periods'));

        $apr = $periods->firstWhere('period', '2026-04');
        $this->assertSame(100000.0, (float) $apr['closing_balance']);

        $jun = $periods->firstWhere('period', '2026-06');
        // 100000 - 10000 actual = 90000
        $this->assertSame(10000.0, (float) $jun['actual_outflow']);
        $this->assertSame(90000.0, (float) $jun['closing_balance']);

        $jul = $periods->firstWhere('period', '2026-07');
        // 90000 + 20000 inflow - 5000 outflow = 105000
        $this->assertSame(20000.0, (float) $jul['scenario_inflow']);
        $this->assertSame(5000.0, (float) $jul['scenario_outflow']);
        $this->assertSame(105000.0, (float) $jul['closing_balance']);
    }

    public function test_imprest_expected_liquidation_drives_projection_month(): void
    {
        Carbon::setTestNow('2026-07-15 10:00:00');

        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'fy' => $fy, 'line' => $line] = $this->seedLine($tenant, 80000);

        $imprest = ImprestRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $finance->id,
            'amount_requested' => 12000,
            'expected_liquidation_date' => '2026-10-12',
            'status' => 'approved',
        ]);

        app(BudgetCommitmentService::class)->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 12000,
            'source_type' => 'imprest',
            'source_id' => $imprest->id,
            'source_key' => 'IMPREST:'.$imprest->id,
            'currency' => 'NAD',
        ], $finance);

        $oct = collect(
            $this->asUser($finance)
                ->getJson('/api/v1/budget/cashflow/forecast?financial_year_id='.$fy->id)
                ->assertOk()
                ->json('data.periods')
        )->firstWhere('period', '2026-10');

        $this->assertNotNull($oct);
        $this->assertSame(12000.0, (float) $oct['projected_outflow']);
    }

    public function test_non_finance_cannot_create_scenario(): void
    {
        $tenant = Tenant::factory()->create();
        ['fy' => $fy] = $this->seedLine($tenant);
        // Staff role includes finance.create in this codebase; use External Auditor (read-only).
        $auditor = $this->makeUser('External Auditor', $tenant);

        $this->asUser($auditor)
            ->postJson('/api/v1/budget/cashflow/scenarios', [
                'financial_year_id' => $fy->id,
                'name' => 'Blocked',
                'opening_balance' => 1,
            ])
            ->assertForbidden();
    }

    public function test_unauthenticated_forecast_is_unauthorized(): void
    {
        $this->getJson('/api/v1/budget/cashflow/forecast?financial_year_id=1')
            ->assertUnauthorized();
    }

    public function test_scenario_is_tenant_scoped(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        ['finance' => $financeA, 'fy' => $fyA] = $this->seedLine($tenantA);
        ['finance' => $financeB] = $this->seedLine($tenantB);

        $scenario = CashflowScenario::create([
            'tenant_id' => $tenantA->id,
            'financial_year_id' => $fyA->id,
            'name' => 'Tenant A only',
            'kind' => 'base',
            'opening_balance' => 5000,
            'currency' => 'NAD',
            'status' => 'draft',
            'created_by' => $financeA->id,
        ]);

        $this->asUser($financeB)
            ->getJson('/api/v1/budget/cashflow/scenarios/'.$scenario->id)
            ->assertNotFound();
    }
}
