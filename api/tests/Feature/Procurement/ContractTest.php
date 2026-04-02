<?php

namespace Tests\Feature\Procurement;

use App\Models\Contract;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class ContractTest extends TestCase
{
    private function makeAwardedRequest(Tenant $tenant, int $userId): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $userId,
            'title'           => 'Security Services',
            'description'     => 'Annual contract',
            'category'        => 'services',
            'estimated_value' => 120000,
            'currency'        => 'NAD',
            'status'          => 'awarded',
            'awarded_at'      => now(),
        ]);
    }

    private function contractPayload(ProcurementRequest $req, Vendor $vendor, array $overrides = []): array
    {
        return array_merge([
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'title'                  => 'Security Services Contract 2026',
            'description'            => 'Annual security services agreement',
            'start_date'             => now()->toDateString(),
            'end_date'               => now()->addYear()->toDateString(),
            'value'                  => 120000,
            'currency'               => 'NAD',
        ], $overrides);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_procurement_officer_can_create_contract(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProcurementOfficer($tenant);
        $req    = $this->makeAwardedRequest($tenant, $user->id);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'SecureGuard Ltd', 'is_approved' => true, 'is_active' => true]);

        $http->postJson('/api/v1/procurement/contracts', $this->contractPayload($req, $vendor))
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft');
    }

    public function test_contract_reference_auto_generated(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProcurementOfficer($tenant);
        $req    = $this->makeAwardedRequest($tenant, $user->id);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);

        $response = $http->postJson('/api/v1/procurement/contracts', $this->contractPayload($req, $vendor))
            ->assertCreated();

        $this->assertStringStartsWith('CTR-', $response->json('data.reference_number'));
    }

    public function test_staff_cannot_create_contract(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $req    = $this->makeAwardedRequest($tenant, $user->id);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);

        $http->postJson('/api/v1/procurement/contracts', $this->contractPayload($req, $vendor))
            ->assertForbidden();
    }

    // ── Status Transitions ────────────────────────────────────────────────────

    public function test_contract_status_transitions_draft_to_active(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProcurementOfficer($tenant);
        $req    = $this->makeAwardedRequest($tenant, $user->id);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create(array_merge($this->contractPayload($req, $vendor), [
            'tenant_id'  => $tenant->id,
            'created_by' => $user->id,
            'status'     => 'draft',
        ]));

        $http->postJson("/api/v1/procurement/contracts/{$contract->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');
    }

    public function test_expired_contracts_flagged_in_list(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);
        $req    = $this->makeAwardedRequest($tenant, $user->id);

        Contract::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'title'                  => 'Expired Contract',
            'start_date'             => now()->subYears(2)->toDateString(),
            'end_date'               => now()->subDays(10)->toDateString(),
            'value'                  => 50000,
            'currency'               => 'NAD',
            'status'                 => 'active',
            'created_by'             => $user->id,
        ]);

        $response = $http->getJson('/api/v1/procurement/contracts?status=active')
            ->assertOk();

        $contract = collect($response->json('data'))->first();
        $this->assertTrue($contract['is_expired'] ?? false);
    }

    public function test_cannot_delete_active_contract(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProcurementOfficer($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);
        $req    = $this->makeAwardedRequest($tenant, $user->id);

        $contract = Contract::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'title'                  => 'Active Contract',
            'start_date'             => now()->toDateString(),
            'end_date'               => now()->addYear()->toDateString(),
            'value'                  => 50000,
            'currency'               => 'NAD',
            'status'                 => 'active',
            'created_by'             => $user->id,
        ]);

        $http->deleteJson("/api/v1/procurement/contracts/{$contract->id}")
            ->assertUnprocessable();
    }

    // ── Tenant Isolation ──────────────────────────────────────────────────────

    public function test_tenant_isolation_on_contracts(): void
    {
        $t1 = Tenant::factory()->create();
        $t2 = Tenant::factory()->create();
        [$http1, $u1] = $this->asProcurementOfficer($t1);
        $vendor2 = Vendor::create(['tenant_id' => $t2->id, 'name' => 'ForeignV', 'is_approved' => true, 'is_active' => true]);
        $req2    = $this->makeAwardedRequest($t2, $u1->id);

        $contract2 = Contract::create([
            'tenant_id'              => $t2->id,
            'procurement_request_id' => $req2->id,
            'vendor_id'              => $vendor2->id,
            'title'                  => 'Cross Tenant',
            'start_date'             => now()->toDateString(),
            'end_date'               => now()->addYear()->toDateString(),
            'value'                  => 10000,
            'currency'               => 'NAD',
            'status'                 => 'draft',
            'created_by'             => $u1->id,
        ]);

        $http1->getJson("/api/v1/procurement/contracts/{$contract2->id}")->assertNotFound();
    }
}
