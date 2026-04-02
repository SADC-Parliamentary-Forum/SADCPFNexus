<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class BudgetReservationTest extends TestCase
{
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

    // ── Budget Reservations ───────────────────────────────────────────────────

    public function test_finance_can_reserve_budget_for_hod_approved_request(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $response = $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line'     => 'IT-2026-Q1',
                 'reserved_amount' => 50000.00,
                 'notes'           => 'Approved in Q1 IT budget allocation.',
             ]);

        $response->assertCreated()
                 ->assertJsonPath('data.budget_line', 'IT-2026-Q1');

        $this->assertEquals(50000, $response->json('data.reserved_amount'));

        $this->assertDatabaseHas('budget_reservations', [
            'procurement_request_id' => $req->id,
            'reserved_by'            => $finance->id,
            'budget_line'            => 'IT-2026-Q1',
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
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $this->asUser($requester)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line'     => 'IT-2026-Q1',
                 'reserved_amount' => 50000.00,
             ])
             ->assertForbidden();
    }

    public function test_cannot_reserve_budget_for_non_hod_approved_request(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);

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
                 'budget_line'     => 'TEST-LINE',
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
             ->assertJsonValidationErrors(['budget_line', 'reserved_amount']);
    }

    public function test_reserved_amount_cannot_exceed_estimated_value(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $finance   = $this->makeUser('Finance Controller', $tenant);
        $req       = $this->makeHodApprovedRequest($tenant, $requester); // estimated_value = 50000

        $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line'     => 'IT-2026-Q1',
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
        $req       = $this->makeHodApprovedRequest($tenant, $requester);

        $response = $this->asUser($finance)
             ->postJson("/api/v1/procurement/requests/{$req->id}/reserve-budget", [
                 'budget_line'     => 'IT-2026-Q1',
                 'reserved_amount' => 50000.00,
             ]);

        $reservationId = $response->json('data.id');

        $this->asUser($finance)
             ->deleteJson("/api/v1/procurement/budget-reservations/{$reservationId}")
             ->assertOk();

        $this->assertDatabaseHas('budget_reservations', [
            'id'          => $reservationId,
        ]);
        // released_at should be set
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
        $reqA      = $this->makeHodApprovedRequest($tenantA, $requesterA);

        $this->asUser($financeA)
             ->postJson("/api/v1/procurement/requests/{$reqA->id}/reserve-budget", [
                 'budget_line'     => 'LINE-A',
                 'reserved_amount' => 50000.00,
             ])
             ->assertCreated();

        $response = $this->asUser($financeB)
             ->getJson('/api/v1/procurement/budget-reservations')
             ->assertOk();

        $this->assertCount(0, $response->json('data'));
    }
}
