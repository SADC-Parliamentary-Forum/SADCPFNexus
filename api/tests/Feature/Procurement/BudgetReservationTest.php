<?php

namespace Tests\Feature\Procurement;

use App\Models\Budget;
use App\Models\BudgetLine;
use App\Models\FinancialYear;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class BudgetReservationTest extends TestCase
{
    private function seedOrgLine(Tenant $tenant, User $actor, string $code = 'IT-2026-Q1', float $allocated = 1_000_000): BudgetLine
    {
        $fy = FinancialYear::defaultAprilMarch($tenant->id, 2026);
        $budget = Budget::create([
            'tenant_id' => $tenant->id,
            'financial_year_id' => $fy->id,
            'year' => '2026',
            'name' => 'Test Budget',
            'type' => 'core',
            'status' => 'active',
            'currency' => 'NAD',
            'total_amount' => $allocated,
            'created_by' => $actor->id,
        ]);

        return BudgetLine::create([
            'budget_id' => $budget->id,
            'code' => $code,
            'name' => $code,
            'category' => 'operational',
            'amount_allocated' => $allocated,
            'original_allocation' => $allocated,
            'amount_spent' => 0,
            'is_active' => true,
        ]);
    }

    private function makeHodApprovedRequest(Tenant $tenant, User $requester): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requester->id,
            'title'           => 'IT Equipment',
            'description'     => 'Laptops for new staff',
            'category'        => 'goods',
            'estimated_value' => 50000.00,
            'currency'        => 'NAD',
            'status'          => 'hod_approved',
        ]);
    }

    public function test_finance_can_reserve_budget_for_hod_approved_request(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $line      = $this->seedOrgLine($tenant, $finance);
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $response = $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line_id'  => $line->id,
                 'reserved_amount' => 50000.00,
                 'notes'           => 'Approved in Q1 IT budget allocation.',
             ]);

        $response->assertCreated()
                 ->assertJsonPath('data.budget_line_id', $line->id);

        $this->assertEquals(50000, $response->json('data.current_amount'));

        $this->assertDatabaseHas('budget_reservations', [
            'procurement_request_id' => $req->id,
            'reserved_by'            => $finance->id,
            'budget_line_id'         => $line->id,
            'source_key'             => 'PROCUREMENT:'.$req->id,
        ]);

        $this->assertDatabaseHas('procurement_requests', [
            'id'     => $req->id,
            'status' => 'budget_reserved',
        ]);
    }

    public function test_staff_cannot_reserve_budget(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $line      = $this->seedOrgLine($tenant, $finance);
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $this->asUser($requester)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line_id'  => $line->id,
                 'reserved_amount' => 50000.00,
             ])
             ->assertForbidden();
    }

    public function test_cannot_reserve_budget_for_non_hod_approved_request(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $line      = $this->seedOrgLine($tenant, $finance, 'TEST-LINE');

        $req = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requester->id,
            'title'           => 'Draft Req',
            'description'     => 'Not yet approved by HOD',
            'category'        => 'goods',
            'estimated_value' => 5000.00,
            'currency'        => 'NAD',
            'status'          => 'submitted',
        ]);

        $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line_id'  => $line->id,
                 'reserved_amount' => 5000.00,
             ])
             ->assertUnprocessable();
    }

    public function test_budget_reservation_requires_budget_line_and_amount(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['reserved_amount']);
    }

    public function test_reserved_amount_cannot_exceed_estimated_value(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $line      = $this->seedOrgLine($tenant, $finance);
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line_id'  => $line->id,
                 'reserved_amount' => 99999.00,
             ])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['reserved_amount']);
    }

    public function test_finance_can_list_budget_reservations(): void
    {
        $tenant  = Tenant::factory()->create();
        $finance = $this->makeUser('Finance Controller', $tenant);

        $this->asUser($finance)
             ->getJson('/api/v1/procurement/budget-reservations')
             ->assertOk()
             ->assertJsonStructure(['data']);
    }

    public function test_finance_can_release_budget_reservation(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $line      = $this->seedOrgLine($tenant, $finance);
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $response = $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line_id'  => $line->id,
                 'reserved_amount' => 50000.00,
             ]);

        $reservationId = $response->json('data.id');

        $this->asUser($finance)
             ->deleteJson("/api/v1/procurement/budget-reservations/{$reservationId}")
             ->assertOk();

        $reservation = \App\Models\BudgetReservation::find($reservationId);
        $this->assertNotNull($reservation->released_at);
    }

    public function test_tenant_isolation_on_budget_reservations(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $financeA  = $this->makeUser('Finance Controller', $tenantA);
        $financeB  = $this->makeUser('Finance Controller', $tenantB);
        $requesterA = $this->makeUser('staff', $tenantA);
        $lineA     = $this->seedOrgLine($tenantA, $financeA, 'LINE-A');
        $reqA      = $this->makeHodApprovedRequest($tenantA, $requesterA);

        $this->asUser($financeA)
             ->postJson("/api/v1/procurement/requests/{$reqA->id}/reserve-budget", [
                 'budget_line_id'  => $lineA->id,
                 'reserved_amount' => 50000.00,
             ])
             ->assertCreated();

        $response = $this->asUser($financeB)
             ->getJson('/api/v1/procurement/budget-reservations')
             ->assertOk();

        $this->assertCount(0, $response->json('data'));
    }

    public function test_procurement_approve_requires_active_budget_reservation(): void
    {
        $tenant = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod = $this->makeUser('HOD', $tenant);
        $officer = $this->makeUser('Procurement Officer', $tenant);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $requester->id,
            'title' => 'No Budget Gate',
            'description' => 'Must fail without reservation',
            'category' => 'goods',
            'estimated_value' => 25_000,
            'currency' => 'NAD',
            'status' => 'submitted',
        ]);

        $this->asUser($hod)->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")->assertOk();

        $this->asUser($officer)
            ->postJson("/api/v1/procurement/requests/{$req->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['budget']);

        $this->reserveBudgetFor($req->fresh(), $this->makeUser('Finance Controller', $tenant));
        $req->update(['status' => 'budget_reserved']);

        $this->asUser($officer)
            ->postJson("/api/v1/procurement/requests/{$req->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_issue_rfq_requires_active_budget_reservation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $category = $this->makeSupplierCategory($tenant);

        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $officer->id,
            'title' => 'RFQ Without Budget',
            'description' => 'Gate check',
            'category' => 'goods',
            'estimated_value' => 45_000,
            'currency' => 'NAD',
            'status' => 'approved',
            'approved_at' => now(),
        ]);

        $http->postJson("/api/v1/procurement/requests/{$req->id}/issue-rfq", [
            'category_ids' => [$category->id],
            'rfq_deadline' => now()->addDays(5)->toDateString(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['budget']);
    }
}
