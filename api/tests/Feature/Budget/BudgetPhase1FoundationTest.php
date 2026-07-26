<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\FinancialYear;
use App\Models\FundingSource;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetActualService;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class BudgetPhase1FoundationTest extends TestCase
{
    private function seedLine(Tenant $tenant, float $allocated = 100000): array
    {
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $source = FundingSource::create([
            'tenant_id' => $tenant->id,
            'code' => 'CORE',
            'name' => 'SADC PF Own Funds',
            'type' => 'own_funds',
            'currency' => 'NAD',
            'is_active' => true,
        ]);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'FY 2026/27 Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $allocated,
            'created_by' => $this->makeFinanceController($tenant)->id,
        ]);
        $line = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'OPS-001',
            'name' => 'Operations',
            'funding_source_id' => $source->id,
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ]);

        return compact('fy', 'source', 'budget', 'line');
    }

    public function test_financial_year_defaults_to_april_march(): void
    {
        $tenant = Tenant::factory()->create();
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);

        $this->assertSame('2026/27', $fy->code);
        $this->assertSame('2026-04-01', $fy->starts_on->toDateString());
        $this->assertSame('2027-03-31', $fy->ends_on->toDateString());
        $this->assertSame('open', $fy->status);
    }

    public function test_availability_formula_subtracts_actuals_and_commitments(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        ['line' => $line] = $this->seedLine($tenant, 500000);

        $commitments = app(BudgetCommitmentService::class);
        $actuals = app(BudgetActualService::class);
        $availability = app(BudgetAvailabilityService::class);

        $commitments->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 250000,
            'source_type' => 'manual',
            'source_id' => 1,
            'source_key' => 'MANUAL:1',
            'currency' => 'NAD',
        ], $finance);

        $actuals->post([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'accounting_reference' => 'INV-1',
            'transaction_date' => '2026-05-01',
            'amount' => 200000,
            'currency' => 'NAD',
        ], $finance);

        $check = $availability->check($line->id, 60000);
        $this->assertSame(500000.0, $check['approved']);
        $this->assertSame(200000.0, $check['actual']);
        $this->assertSame(250000.0, $check['commitments']);
        $this->assertSame(50000.0, $check['available']);
        $this->assertFalse($check['sufficient']);
        $this->assertContains('insufficient_funds', $check['warnings']);
    }

    public function test_commitment_idempotent_by_source_key(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        ['line' => $line] = $this->seedLine($tenant, 100000);
        $svc = app(BudgetCommitmentService::class);

        $a = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 40000,
            'source_type' => 'pif',
            'source_id' => 99,
            'source_key' => 'PIF:99',
        ], $finance);

        $b = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 40000,
            'source_type' => 'pif',
            'source_id' => 99,
            'source_key' => 'PIF:99',
        ], $finance);

        $this->assertSame($a->id, $b->id);
        $this->assertSame(1, BudgetReservation::where('source_key', 'PIF:99')->count());
    }

    public function test_transfer_does_not_duplicate_commitment_amount(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        ['line' => $line] = $this->seedLine($tenant, 100000);
        $svc = app(BudgetCommitmentService::class);
        $availability = app(BudgetAvailabilityService::class);

        $parent = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 100000,
            'source_type' => 'pif',
            'source_id' => 1,
            'source_key' => 'PIF:1',
        ], $finance);

        $child = $svc->transfer($parent, [
            'source_type' => 'procurement',
            'source_id' => 2,
            'source_key' => 'PROCUREMENT:2',
            'amount' => 95000,
            'procurement_request_id' => null,
        ], $finance);

        $this->assertSame($parent->commitment_chain_id, $child->commitment_chain_id);
        $this->assertSame($parent->id, $child->parent_commitment_id);
        $this->assertSame(95000.0, (float) $child->current_amount);

        $check = $availability->check($line->id);
        $this->assertSame(95000.0, $check['commitments']);
        $this->assertSame(5000.0, $check['available']);
    }

    public function test_second_concurrent_style_reserve_fails_when_insufficient(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        ['line' => $line] = $this->seedLine($tenant, 100000);
        $svc = app(BudgetCommitmentService::class);

        $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 80000,
            'source_type' => 'pif',
            'source_id' => 10,
            'source_key' => 'PIF:10',
        ], $finance);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 80000,
            'source_type' => 'pif',
            'source_id' => 11,
            'source_key' => 'PIF:11',
        ], $finance);
    }

    public function test_csv_import_posts_actuals(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        ['line' => $line] = $this->seedLine($tenant, 100000);

        $csv = "accounting_reference,transaction_date,budget_line_code,amount,currency\n"
            ."INV-100,2026-06-01,OPS-001,25000,NAD\n";
        $file = UploadedFile::fake()->createWithContent('actuals.csv', $csv);

        $result = app(BudgetActualService::class)->importCsv($file, $tenant->id, $finance);
        $this->assertSame(1, $result['imported']);

        $check = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(25000.0, $check['actual']);
        $this->assertSame(75000.0, $check['available']);
    }

    public function test_release_restores_available_budget(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        ['line' => $line] = $this->seedLine($tenant, 100000);
        $svc = app(BudgetCommitmentService::class);

        $c = $svc->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 40000,
            'source_type' => 'travel',
            'source_id' => 5,
            'source_key' => 'TRAVEL:5',
        ], $finance);

        $svc->release($c, $finance, 'Cancelled');
        $check = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(0.0, $check['commitments']);
        $this->assertSame(100000.0, $check['available']);
    }
}
