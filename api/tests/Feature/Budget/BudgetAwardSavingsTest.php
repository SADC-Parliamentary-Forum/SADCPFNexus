<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\FinancialYear;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Budget\Services\BudgetCommitmentService;
use App\Modules\Procurement\Services\ProcurementService;
use ReflectionMethod;
use Tests\TestCase;

class BudgetAwardSavingsTest extends TestCase
{
    public function test_award_savings_release_restores_available_budget(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $requester = $this->makeUser('staff', $tenant);

        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => 100000,
            'created_by' => $finance->id,
        ]);
        $line = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'PROC-SAVE',
            'name' => 'Procurement savings line',
            'category' => 'operational',
            'amount_allocated' => 100000,
            'original_allocation' => 100000,
            'amount_spent' => 0,
            'is_active' => true,
        ]);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'Laptops',
            'description' => 'Award savings test',
            'category' => 'goods',
            'estimated_value' => 100000,
            'currency' => 'NAD',
            'status' => 'budget_reserved',
        ]);

        app(BudgetCommitmentService::class)->reserve([
            'tenant_id' => $tenant->id,
            'budget_line_id' => $line->id,
            'amount' => 100000,
            'source_type' => 'procurement',
            'source_id' => $req->id,
            'source_key' => 'PROCUREMENT:'.$req->id,
            'procurement_request_id' => $req->id,
            'confirm' => true,
        ], $finance);

        $before = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(0.0, $before['available']);

        $method = new ReflectionMethod(ProcurementService::class, 'adjustCommitmentToAwardAmount');
        $method->setAccessible(true);
        $method->invoke(app(ProcurementService::class), $req, 84000.0, $finance);

        $after = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(84000.0, $after['commitments']);
        $this->assertSame(16000.0, $after['available']);
    }
}
