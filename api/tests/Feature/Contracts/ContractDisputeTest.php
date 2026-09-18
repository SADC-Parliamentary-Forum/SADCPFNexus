<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use Tests\TestCase;

/**
 * Contract dispute sub-record (PRD §78).
 */
class ContractDisputeTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(): Contract
    {
        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'counterparty_type' => 'organisation', 'title' => 'C', 'currency' => 'USD',
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000,
            'contract_status' => 'ACTIVE', 'status' => 'active',
        ]);
    }

    public function test_raise_list_and_resolve_dispute(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $id = $po->postJson("/api/v1/contracts/{$contract->id}/disputes", [
            'type' => 'payment', 'description' => 'Counterparty disputes milestone 2 payment', 'amount_at_risk' => 1200, 'legal_involved' => true,
        ])->assertCreated()
            ->assertJsonPath('data.status', 'open')
            ->assertJsonPath('data.type', 'payment')
            ->json('data.id');

        $po->getJson("/api/v1/contracts/{$contract->id}/disputes")->assertOk()->assertJsonCount(1, 'data');

        $po->patchJson("/api/v1/contracts/{$contract->id}/disputes/{$id}", ['status' => 'resolved', 'resolution' => 'Settled at N$1,000'])
            ->assertOk()
            ->assertJsonPath('data.status', 'resolved')
            ->assertJsonPath('data.resolution', 'Settled at N$1,000');

        $this->assertNotNull(\App\Models\ContractDispute::find($id)->resolved_at);
    }

    public function test_dispute_creation_requires_permission(): void
    {
        $contract = $this->contract();
        [$staff] = $this->asStaff($this->tenant);

        $staff->postJson("/api/v1/contracts/{$contract->id}/disputes", ['type' => 'other', 'description' => 'x'])->assertForbidden();
    }
}
