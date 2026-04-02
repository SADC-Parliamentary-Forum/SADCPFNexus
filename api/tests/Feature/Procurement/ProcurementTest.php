<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\Tenant;
use Tests\TestCase;

class ProcurementTest extends TestCase
{
    private function procPayload(array $overrides = []): array
    {
        return array_merge([
            'title'           => 'Office Supplies Purchase',
            'description'     => 'Annual stationery and office consumables procurement',
            'category'        => 'goods',
            'estimated_value' => 12000.00,
            'currency'        => 'NAD',
        ], $overrides);
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_procurement_requests(): void
    {
        $this->getJson('/api/v1/procurement/requests')->assertUnauthorized();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function test_staff_can_create_procurement_request(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/procurement/requests', $this->procPayload());

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.title', 'Office Supplies Purchase');

        $this->assertDatabaseHas('procurement_requests', [
            'requester_id' => $user->id,
            'status'       => 'draft',
        ]);
    }

    public function test_create_request_requires_title_description_and_category(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/procurement/requests', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['title', 'description', 'category']);
    }

    public function test_staff_can_list_own_requests(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $myUser] = $this->asStaff($tenant);

        $otherUser = $this->makeUser('staff', $tenant);
        ProcurementRequest::create([
            'tenant_id'        => $tenant->id,
            'requester_id'     => $otherUser->id,
            'title'            => 'Other Request',
            'description'      => 'Other description',
            'category'         => 'goods',
            'estimated_value'  => 5000,
            'currency'         => 'NAD',
            'status'           => 'draft',
        ]);

        $http->postJson('/api/v1/procurement/requests', $this->procPayload());

        $response = $http->getJson('/api/v1/procurement/requests');
        $response->assertOk();

        $requesterIds = collect($response->json('data'))->pluck('requester_id')->unique()->values()->toArray();
        $this->assertNotContains($otherUser->id, $requesterIds);
    }

    public function test_procurement_officer_can_see_all_requests_in_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        $staffA = $this->makeUser('staff', $tenant);
        $staffB = $this->makeUser('staff', $tenant);

        foreach ([$staffA, $staffB] as $s) {
            ProcurementRequest::create([
                'tenant_id'       => $tenant->id,
                'requester_id'    => $s->id,
                'title'           => "Request by {$s->id}",
                'description'     => 'Test description',
                'category'        => 'goods',
                'estimated_value' => 3000,
                'currency'        => 'NAD',
                'status'          => 'submitted',
            ]);
        }

        [$http] = $this->asProcurementOfficer($tenant);
        $response = $http->getJson('/api/v1/procurement/requests');
        $response->assertOk();

        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_staff_can_update_draft_request(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/procurement/requests', $this->procPayload());
        $id = $create->json('data.id');

        $http->putJson("/api/v1/procurement/requests/{$id}", $this->procPayload([
            'title'           => 'Updated Title',
            'estimated_value' => 25000,
        ]))->assertOk()
           ->assertJsonPath('data.title', 'Updated Title');
    }

    public function test_staff_can_delete_draft_request(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/procurement/requests', $this->procPayload());
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/procurement/requests/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('procurement_requests', ['id' => $id]);
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    public function test_staff_can_submit_draft_request(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/procurement/requests', $this->procPayload());
        $id = $create->json('data.id');

        $http->postJson("/api/v1/procurement/requests/{$id}/submit")
             ->assertOk()
             ->assertJsonPath('data.status', 'submitted');
    }

    public function test_staff_cannot_submit_another_users_request(): void
    {
        $tenant   = Tenant::factory()->create();
        $owner    = $this->makeUser('staff', $tenant);
        $intruder = $this->makeUser('staff', $tenant);

        $req = ProcurementRequest::create([
            'tenant_id'       => $tenant->id,
            'requester_id'    => $owner->id,
            'title'           => 'Owner Request',
            'description'     => 'Owner description',
            'category'        => 'goods',
            'estimated_value' => 8000,
            'currency'        => 'NAD',
            'status'          => 'draft',
        ]);

        $this->asUser($intruder)
             ->postJson("/api/v1/procurement/requests/{$req->id}/submit")
             ->assertForbidden();
    }

    // ── Approve / Reject ──────────────────────────────────────────────────────

    public function test_procurement_officer_can_approve_submitted_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$staffHttp] = $this->asStaff($tenant);

        $create = $staffHttp->postJson('/api/v1/procurement/requests', $this->procPayload());
        $id = $create->json('data.id');
        $staffHttp->postJson("/api/v1/procurement/requests/{$id}/submit");

        // HOD must approve first before procurement officer can approve
        $hod = $this->makeUser('HOD', $tenant);
        $this->asUser($hod)->postJson("/api/v1/procurement/requests/{$id}/hod-approve")->assertOk();

        [$procHttp] = $this->asProcurementOfficer($tenant);

        $procHttp->postJson("/api/v1/procurement/requests/{$id}/approve", [
            'comment' => 'Budget available — approved',
        ])->assertOk()
          ->assertJsonPath('data.status', 'approved');
    }

    public function test_procurement_officer_can_reject_submitted_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$staffHttp] = $this->asStaff($tenant);

        $create = $staffHttp->postJson('/api/v1/procurement/requests', $this->procPayload());
        $id = $create->json('data.id');
        $staffHttp->postJson("/api/v1/procurement/requests/{$id}/submit");

        [$procHttp] = $this->asProcurementOfficer($tenant);

        $procHttp->postJson("/api/v1/procurement/requests/{$id}/reject", [
            'comment' => 'Over budget threshold for this quarter',
        ])->assertOk()
          ->assertJsonPath('data.status', 'rejected');
    }

    public function test_staff_cannot_approve_procurement_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$httpA] = $this->asStaff($tenant);
        [$httpB] = $this->asStaff($tenant);

        $create = $httpA->postJson('/api/v1/procurement/requests', $this->procPayload());
        $id = $create->json('data.id');
        $httpA->postJson("/api/v1/procurement/requests/{$id}/submit");

        $httpB->postJson("/api/v1/procurement/requests/{$id}/approve")
              ->assertForbidden();
    }

    // ── Cross-tenant isolation ────────────────────────────────────────────────

    public function test_cannot_access_procurement_request_from_different_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$httpA, $userA] = $this->asStaff($tenantA);
        $createA = $httpA->postJson('/api/v1/procurement/requests', $this->procPayload());
        $idA = $createA->json('data.id');

        [$httpB] = $this->asStaff($tenantB);

        $httpB->getJson("/api/v1/procurement/requests/{$idA}")
              ->assertNotFound();
    }
}
