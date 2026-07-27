<?php

namespace Tests\Feature\Imprest;

use App\Models\Budget;
use App\Models\BudgetActualTransaction;
use App\Models\BudgetLine;
use App\Models\BudgetReservation;
use App\Models\FinancialYear;
use App\Models\Tenant;
use App\Modules\Budget\Services\BudgetAvailabilityService;
use App\Modules\Imprest\Services\ImprestBudgetReservationService;
use App\Modules\Imprest\Services\ImprestService;
use Tests\TestCase;

class ImprestBudgetWiringTest extends TestCase
{
    private function seedLine(Tenant $tenant, float $allocated = 100000): array
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
        $line = BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => 'IMP-OPS',
            'name' => 'Imprest Ops',
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ]);

        return compact('finance', 'fy', 'budget', 'line');
    }

    public function test_approve_reserves_commitment_and_retire_settles(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'line' => $line] = $this->seedLine($tenant, 100000);
        $staff = $this->makeUser('staff', $tenant);
        $svc = app(ImprestService::class);

        $imprest = $svc->create([
            'budget_line_id' => $line->id,
            'amount_requested' => 10000,
            'currency' => 'NAD',
            'expected_liquidation_date' => now()->addDays(20)->toDateString(),
            'purpose' => 'Workshop float',
        ], $staff);

        $imprest = $svc->submit($imprest, $staff);
        $imprest = $svc->approve($imprest, ['amount_approved' => 10000], $finance);

        $reservation = BudgetReservation::query()
            ->where('source_key', 'IMPREST:'.$imprest->id)
            ->first();
        $this->assertNotNull($reservation);
        $this->assertTrue($reservation->isActive());
        $this->assertSame(10000.0, (float) $reservation->current_amount);

        $avail = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(90000.0, $avail['available']);

        $imprest = $svc->retire($imprest, ['amount_liquidated' => 7500], $staff);
        $this->assertSame('liquidated', $imprest->status);

        $reservation->refresh();
        $this->assertFalse($reservation->isActive());

        $this->assertDatabaseHas('budget_actual_transactions', [
            'accounting_reference' => 'IMPREST:'.$imprest->id,
            'budget_line_id' => $line->id,
        ]);
        $actual = BudgetActualTransaction::query()
            ->where('accounting_reference', 'IMPREST:'.$imprest->id)
            ->first();
        $this->assertSame(7500.0, (float) $actual->amount);

        $avail = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(7500.0, $avail['actual']);
        $this->assertSame(0.0, $avail['commitments']);
        $this->assertSame(92500.0, $avail['available']);
    }

    public function test_release_on_cancel_restores_availability(): void
    {
        $tenant = Tenant::factory()->create();
        ['finance' => $finance, 'line' => $line] = $this->seedLine($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $svc = app(ImprestService::class);

        $imprest = $svc->create([
            'budget_line_id' => $line->id,
            'amount_requested' => 5000,
            'currency' => 'NAD',
            'expected_liquidation_date' => now()->addDays(10)->toDateString(),
            'purpose' => 'Test',
        ], $staff);
        $imprest = $svc->submit($imprest, $staff);
        $imprest = $svc->approve($imprest, [], $finance);

        $avail = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(95000.0, $avail['available']);

        app(ImprestBudgetReservationService::class)
            ->releaseOnCancel($imprest->fresh(), $finance, 'Imprest withdrawn');

        $reservation = BudgetReservation::query()
            ->where('source_key', 'IMPREST:'.$imprest->id)
            ->first();
        $this->assertNotNull($reservation);
        $this->assertTrue($reservation->isReleased());

        $avail = app(BudgetAvailabilityService::class)->check($line->id);
        $this->assertSame(100000.0, $avail['available']);
        $this->assertSame(0.0, $avail['commitments']);
    }

    public function test_http_create_with_budget_line_id(): void
    {
        $tenant = Tenant::factory()->create();
        ['line' => $line] = $this->seedLine($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $this->asUser($staff)
            ->postJson('/api/v1/imprest/requests', [
                'budget_line_id' => $line->id,
                'amount_requested' => 1500,
                'currency' => 'NAD',
                'expected_liquidation_date' => now()->addDays(30)->toDateString(),
                'purpose' => 'Stationery',
            ])
            ->assertCreated()
            ->assertJsonPath('data.budget_line_id', $line->id);
    }

    public function test_legacy_free_text_budget_line_still_creates(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $this->asUser($staff)
            ->postJson('/api/v1/imprest/requests', [
                'budget_line' => 'Operations - Petty Cash',
                'amount_requested' => 800,
                'currency' => 'NAD',
                'expected_liquidation_date' => now()->addDays(14)->toDateString(),
                'purpose' => 'Legacy path',
            ])
            ->assertCreated()
            ->assertJsonPath('data.budget_line', 'Operations - Petty Cash');
    }
}
