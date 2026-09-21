<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractKeyPersonnel;
use App\Models\Tenant;
use Tests\TestCase;

/**
 * Key personnel + replacement approval (PRD §80).
 */
class ContractKeyPersonnelTest extends TestCase
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

    public function test_add_personnel_request_and_approve_replacement(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $personId = $po->postJson("/api/v1/contracts/{$contract->id}/key-personnel", [
            'name' => 'Jane Doe', 'role' => 'Lead Interpreter', 'cv_reference' => 'CV-001',
        ])->assertCreated()->json('data.id');

        $replId = $po->postJson("/api/v1/contracts/{$contract->id}/key-personnel/{$personId}/replace", [
            'proposed_name' => 'John Smith', 'proposed_role' => 'Lead Interpreter', 'reason' => 'Original unavailable',
        ])->assertCreated()->json('data.id');

        // Approver (SG has approve).
        [$sg] = $this->asSG($this->tenant);
        $successorId = $sg->postJson("/api/v1/contracts/{$contract->id}/personnel-replacements/{$replId}/approve", ['note' => 'ok'])
            ->assertOk()->json('data.id');

        $this->assertSame('replaced', ContractKeyPersonnel::find($personId)->status);
        $this->assertSame($successorId, ContractKeyPersonnel::find($personId)->replaced_by_id);
        $this->assertSame('John Smith', ContractKeyPersonnel::find($successorId)->name);
        $this->assertSame('active', ContractKeyPersonnel::find($successorId)->status);

        // Listing shows both, no pending replacements left.
        $po->getJson("/api/v1/contracts/{$contract->id}/key-personnel")->assertOk()
            ->assertJsonCount(2, 'data.personnel')
            ->assertJsonCount(0, 'data.pending_replacements');
    }

    public function test_reject_replacement_keeps_original_active(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);
        $person = ContractKeyPersonnel::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'name' => 'A', 'role' => 'R', 'status' => 'active',
        ]);
        $replId = $po->postJson("/api/v1/contracts/{$contract->id}/key-personnel/{$person->id}/replace", [
            'proposed_name' => 'B', 'proposed_role' => 'R', 'reason' => 'x',
        ])->assertCreated()->json('data.id');

        [$sg] = $this->asSG($this->tenant);
        $sg->postJson("/api/v1/contracts/{$contract->id}/personnel-replacements/{$replId}/reject", ['note' => 'no'])->assertOk();

        $this->assertSame('active', ContractKeyPersonnel::find($person->id)->status);
    }

    public function test_personnel_add_requires_permission(): void
    {
        $contract = $this->contract();
        [$staff] = $this->asStaff($this->tenant);
        $staff->postJson("/api/v1/contracts/{$contract->id}/key-personnel", ['name' => 'X', 'role' => 'Y'])->assertForbidden();
    }
}
