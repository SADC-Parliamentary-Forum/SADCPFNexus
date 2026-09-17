<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * WS0 — first-class Contract module surface + RBAC separation of duties.
 */
class ContractModuleScaffoldingTest extends TestCase
{
    private function makeVendor(Tenant $tenant): Vendor
    {
        return Vendor::create([
            'tenant_id' => $tenant->id,
            'name' => 'Interpreter Services CC',
            'contact_email' => 'vendor-'.uniqid().'@example.test',
            'status' => 'approved',
            'is_approved' => true,
            'is_active' => true,
        ]);
    }

    private function contractPayload(Vendor $vendor): array
    {
        return [
            'vendor_id' => $vendor->id,
            'title' => 'French Interpretation — Legal Drafters Meeting',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(12)->toDateString(),
            'value' => 900,
            'currency' => 'USD',
        ];
    }

    public function test_procurement_officer_can_list_and_create_contracts(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = $this->makeVendor($tenant);

        $http->getJson('/api/v1/contracts')->assertOk()->assertJsonStructure(['data']);

        $http->postJson('/api/v1/contracts', $this->contractPayload($vendor))
            ->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.value', '900.00');
    }

    public function test_procurement_officer_cannot_approve_own_contract(): void
    {
        // Separation of duties: the custodian prepares but never approves/signs.
        $tenant = Tenant::factory()->create();
        [$http, $officer] = $this->asProcurementOfficer($tenant);
        $vendor = $this->makeVendor($tenant);

        $contract = Contract::create(array_merge($this->contractPayload($vendor), [
            'tenant_id' => $tenant->id,
            'created_by' => $officer->id,
            'status' => 'draft',
        ]));

        $http->postJson("/api/v1/contracts/{$contract->id}/activate")->assertForbidden();
    }

    public function test_secretary_general_can_approve_but_not_create(): void
    {
        $tenant = Tenant::factory()->create();
        $vendor = $this->makeVendor($tenant);
        $contract = Contract::create(array_merge($this->contractPayload($vendor), [
            'tenant_id' => $tenant->id,
            'created_by' => $this->makeProcurementOfficer($tenant)->id,
            'status' => 'draft',
        ]));

        [$http] = $this->asSG($tenant);

        // SG holds contract.approve (activation) but not contract.create.
        $http->postJson("/api/v1/contracts/{$contract->id}/activate")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $http->postJson('/api/v1/contracts', $this->contractPayload($vendor))->assertForbidden();
    }

    public function test_cross_tenant_contract_is_not_found(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();
        $vendor = $this->makeVendor($tenantA);
        $contract = Contract::create(array_merge($this->contractPayload($vendor), [
            'tenant_id' => $tenantA->id,
            'created_by' => $this->makeProcurementOfficer($tenantA)->id,
            'status' => 'draft',
        ]));

        [$http] = $this->asProcurementOfficer($tenantB);
        $http->getJson("/api/v1/contracts/{$contract->id}")->assertNotFound();
    }
}
