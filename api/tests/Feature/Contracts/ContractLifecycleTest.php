<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * P1 — contract suspension and termination (PRD §75–§77).
 */
class ContractLifecycleTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function activeContract(): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Acme', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'counterparty_name' => 'Acme',
            'title' => 'Service', 'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addMonths(6)->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'currency' => 'USD',
            'contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed',
        ]);
    }

    public function test_secretary_general_can_suspend_and_resume(): void
    {
        $contract = $this->activeContract();
        [$sg] = $this->asSG($this->tenant);

        $sg->postJson("/api/v1/contracts/{$contract->id}/suspend", [
            'reason' => 'Awaiting revised scope', 'payment_impact' => 'Payments paused',
        ])->assertOk()->assertJsonPath('data.contract_status', 'SUSPENDED');

        $this->assertDatabaseHas('contract_suspensions', ['contract_id' => $contract->id, 'status' => 'active']);

        $sg->postJson("/api/v1/contracts/{$contract->id}/resume")->assertOk()
            ->assertJsonPath('data.contract_status', 'ACTIVE');

        $this->assertDatabaseHas('contract_suspensions', ['contract_id' => $contract->id, 'status' => 'lifted']);
    }

    public function test_procurement_officer_cannot_suspend(): void
    {
        $contract = $this->activeContract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/suspend", ['reason' => 'x'])->assertForbidden();
    }

    public function test_termination_creates_record_and_preserves_contract(): void
    {
        $contract = $this->activeContract();
        [$sg] = $this->asSG($this->tenant);

        $sg->postJson("/api/v1/contracts/{$contract->id}/terminate", [
            'type' => 'cause', 'reason' => 'Persistent non-performance', 'final_amount' => 1200,
        ])->assertOk()->assertJsonPath('data.contract_status', 'TERMINATED');

        // Termination is a child record; the contract still exists (never deleted).
        $this->assertDatabaseHas('contract_terminations', ['contract_id' => $contract->id, 'type' => 'cause']);
        $this->assertDatabaseHas('contracts', ['id' => $contract->id, 'contract_status' => 'TERMINATED']);
        $this->assertNotNull(Contract::find($contract->id));
    }

    public function test_only_active_contracts_can_be_suspended(): void
    {
        $contract = $this->activeContract();
        $contract->update(['contract_status' => 'DRAFT', 'status' => 'draft']);
        [$sg] = $this->asSG($this->tenant);

        $sg->postJson("/api/v1/contracts/{$contract->id}/suspend", ['reason' => 'x'])->assertStatus(422);
    }
}
