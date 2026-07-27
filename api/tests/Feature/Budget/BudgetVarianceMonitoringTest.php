<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\BudgetVariance;
use App\Models\FinancialYear;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetActualService;
use App\Modules\Budget\Services\BudgetVarianceService;
use Tests\TestCase;

class BudgetVarianceMonitoringTest extends TestCase
{
    private function seedLine(Tenant $tenant, float $allocated = 100000): BudgetLine
    {
        $finance = $this->makeFinanceController($tenant);
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $allocated,
            'created_by' => $finance->id,
        ]);

        return BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'VAR-001',
            'name' => 'Variance line',
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
    }

    public function test_significant_variance_requires_explanation(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $line = $this->seedLine($tenant, 100000);

        // Spend only 50k → 50% underspend variance (significant vs 20% threshold)
        app(BudgetActualService::class)->post([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'accounting_reference' => 'INV-VAR-1',
            'transaction_date' => '2026-06-01',
            'amount' => 50000,
        ], $finance);

        $row = app(BudgetVarianceService::class)->snapshotLine($line);
        $this->assertTrue($row->is_significant);
        $this->assertSame('explanation_required', $row->status);
        $this->assertSame(50.0, (float) $row->variance_pct);
    }

    public function test_explanation_and_finance_review_workflow(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $hod = $this->makeUser('HOD', $tenant);
        $line = $this->seedLine($tenant, 100000);

        app(BudgetActualService::class)->post([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'accounting_reference' => 'INV-VAR-2',
            'transaction_date' => '2026-06-01',
            'amount' => 30000,
        ], $finance);

        $variance = app(BudgetVarianceService::class)->snapshotLine($line);

        $this->asUser($hod)
            ->postJson("/api/v1/budget/variance/{$variance->id}/explanation", [
                'category' => 'activity_delayed',
                'explanation' => 'Committee meeting postponed to Q3.',
                'remedial_action' => 'Re-schedule and reforecast.',
            ])
            ->assertCreated()
            ->assertJsonPath('data.category', 'activity_delayed');

        $this->assertDatabaseHas('budget_variances', [
            'id' => $variance->id,
            'status' => 'explained',
        ]);

        $explanationId = BudgetVariance::find($variance->id)->explanations()->latest('id')->value('id');

        $this->asUser($finance)
            ->postJson("/api/v1/budget/variance/explanations/{$explanationId}/review", [
                'decision' => 'accepted',
                'finance_comments' => 'Noted.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('budget_variances', [
            'id' => $variance->id,
            'status' => 'finance_reviewed',
        ]);
    }

    public function test_scan_endpoint_snapshots_tenant_lines(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $this->seedLine($tenant, 100000);

        $this->asUser($finance)
            ->postJson('/api/v1/budget/variance/scan')
            ->assertOk()
            ->assertJsonPath('data.scanned', 1);
    }
}
