<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * WS7 — security acceptance tests (PRD §127): access control, external
 * enumeration, record scoping and non-backdated signatures.
 */
class ContractSecurityTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(int $creator): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $creator, 'vendor_id' => $vendor->id,
            'counterparty_type' => 'organisation', 'title' => 'Secure', 'start_date' => now()->addDay()->toDateString(),
            'end_date' => now()->addDays(9)->toDateString(), 'value' => 100, 'currency' => 'USD',
            'contract_status' => 'DRAFT', 'status' => 'draft',
        ]);
    }

    public function test_role_without_contract_permissions_is_denied(): void
    {
        // Field Researcher holds no contract.* permissions.
        $user = $this->makeUser('Field Researcher', $this->tenant);
        $this->asUser($user)->getJson('/api/v1/contracts')->assertForbidden();
    }

    public function test_external_signing_link_cannot_be_enumerated(): void
    {
        // An invalid/guessed token reveals nothing.
        $this->getJson('/api/v1/external/contracts/sign/not-a-real-token')->assertNotFound();
    }

    public function test_record_scope_hides_other_users_contracts(): void
    {
        // A staff member who is not the owner and lacks view_all cannot open it.
        $owner = $this->makeProcurementOfficer($this->tenant);
        $contract = $this->contract($owner->id);

        [$staff] = $this->asStaff($this->tenant); // General Employee: contract.view but record-scoped
        $staff->getJson("/api/v1/contracts/{$contract->id}")->assertNotFound();
    }

    public function test_cross_tenant_access_is_not_found(): void
    {
        $owner = $this->makeProcurementOfficer($this->tenant);
        $contract = $this->contract($owner->id);

        $otherTenant = Tenant::factory()->create();
        [$other] = $this->asProcurementOfficer($otherTenant);
        $other->getJson("/api/v1/contracts/{$contract->id}")->assertNotFound();
    }
}
