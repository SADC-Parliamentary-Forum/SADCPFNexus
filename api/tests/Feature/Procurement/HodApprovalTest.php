<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class HodApprovalTest extends TestCase
{
    private function makeSubmittedRequest(Tenant $tenant, User $requester): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requester->id,
            'title'           => 'Office Supplies',
            'description'     => 'Annual office supplies',
            'category'        => 'goods',
            'estimated_value' => 5000.00,
            'currency'        => 'NAD',
            'status'          => 'submitted',
        ]);
    }

    // ── HOD Review ────────────────────────────────────────────────────────────

    public function test_hod_can_approve_submitted_request(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod       = $this->makeUser('HOD', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($hod)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")
             ->assertOk()
             ->assertJsonPath('data.status', 'hod_approved');

        $this->assertDatabaseHas('procurement_requests', [
            'id'     => $req->id,
            'status' => 'hod_approved',
            'hod_id' => $hod->id,
        ]);
    }

    public function test_hod_can_reject_submitted_request_with_reason(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod       = $this->makeUser('HOD', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($hod)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-reject", [
                 'reason' => 'Budget not available this quarter.',
             ])
             ->assertOk()
             ->assertJsonPath('data.status', 'hod_rejected');

        $this->assertDatabaseHas('procurement_requests', [
            'id'               => $req->id,
            'status'           => 'hod_rejected',
            'rejection_reason' => 'Budget not available this quarter.',
        ]);
    }

    public function test_hod_reject_requires_reason(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod       = $this->makeUser('HOD', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($hod)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-reject", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['reason']);
    }

    public function test_hod_cannot_approve_non_submitted_request(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod       = $this->makeUser('HOD', $tenant);

        $req = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $requester->id,
            'title'           => 'Draft Request',
            'description'     => 'Still a draft',
            'category'        => 'goods',
            'estimated_value' => 1000.00,
            'currency'        => 'NAD',
            'status'          => 'draft',
        ]);

        $this->asUser($hod)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")
             ->assertUnprocessable();
    }

    public function test_staff_cannot_hod_approve(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($requester)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")
             ->assertForbidden();
    }

    public function test_procurement_officer_cannot_hod_approve(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $officer   = $this->makeUser('Procurement Officer', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($officer)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")
             ->assertForbidden();
    }

    public function test_hod_approved_request_is_then_routable_to_procurement(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $hod       = $this->makeUser('HOD', $tenant);
        $officer   = $this->makeUser('Procurement Officer', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($hod)
             ->postJson("/api/v1/procurement/requests/{$req->id}/hod-approve")
             ->assertOk();

        $this->asUser($officer)
             ->postJson("/api/v1/procurement/requests/{$req->id}/approve")
             ->assertOk();

        $this->assertDatabaseHas('procurement_requests', [
            'id'     => $req->id,
            'status' => 'approved',
        ]);
    }

    public function test_procurement_cannot_approve_if_hod_has_not_reviewed(): void
    {
        $tenant    = Tenant::factory()->create();
        $requester = $this->makeUser('staff', $tenant);
        $officer   = $this->makeUser('Procurement Officer', $tenant);
        $req       = $this->makeSubmittedRequest($tenant, $requester);

        $this->asUser($officer)
             ->postJson("/api/v1/procurement/requests/{$req->id}/approve")
             ->assertUnprocessable();
    }
}
