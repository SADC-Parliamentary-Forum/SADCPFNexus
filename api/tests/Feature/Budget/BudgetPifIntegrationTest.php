<?php

namespace Tests\Feature\Budget;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\FinancialYear;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class BudgetPifIntegrationTest extends TestCase
{
    private function seedLine(Tenant $tenant, $finance, string $code = 'PROG-1'): BudgetLine
    {
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'Core',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => 200000,
            'created_by' => $finance->id,
        ]);

        return BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => $code,
            'name' => 'Programme line',
            'category' => 'programme',
            'amount_allocated' => 200000,
            'original_allocation' => 200000,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
    }

    public function test_finance_certification_creates_pif_commitment(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $officer = $this->makeUser('Programme Officer', $tenant);
        $line = $this->seedLine($tenant, $finance);

        $programmeId = $this->asUser($officer)->postJson('/api/v1/programmes', [
            'title' => 'Budget Cert PIF',
            'total_budget' => 75000,
        ])->json('data.id');

        Programme::whereKey($programmeId)->update(['total_budget' => 75000]);

        $this->asUser($finance)
            ->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
                'budget_availability_status' => 'available',
                'budget_line_id' => $line->id,
                'commitment_amount' => 75000,
                'finance_comments' => 'Funds confirmed',
            ])
            ->assertOk();

        $this->assertDatabaseHas('budget_reservations', [
            'source_key' => 'PIF:'.$programmeId,
            'budget_line_id' => $line->id,
            'status' => 'confirmed',
        ]);

        $commitment = BudgetReservation::where('source_key', 'PIF:'.$programmeId)->first();
        $this->assertSame(75000.0, (float) $commitment->current_amount);
    }

    public function test_unavailable_status_releases_pif_commitment(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeFinanceController($tenant);
        $officer = $this->makeUser('Programme Officer', $tenant);
        $line = $this->seedLine($tenant, $finance, 'PROG-2');

        $programmeId = $this->asUser($officer)->postJson('/api/v1/programmes', [
            'title' => 'Budget Release PIF',
            'total_budget' => 40000,
        ])->json('data.id');

        Programme::whereKey($programmeId)->update(['total_budget' => 40000]);

        $this->asUser($finance)
            ->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
                'budget_availability_status' => 'available',
                'budget_line_id' => $line->id,
                'commitment_amount' => 40000,
            ])
            ->assertOk();

        $this->asUser($finance)
            ->putJson("/api/v1/programmes/{$programmeId}/finance-review", [
                'budget_availability_status' => 'unavailable',
            ])
            ->assertOk();

        $commitment = BudgetReservation::where('source_key', 'PIF:'.$programmeId)->first();
        $this->assertTrue($commitment->isReleased());
    }
}
