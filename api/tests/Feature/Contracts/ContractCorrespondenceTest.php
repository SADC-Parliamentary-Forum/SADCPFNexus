<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use Tests\TestCase;

/**
 * Contract → Correspondence integration (PRD §63).
 */
class ContractCorrespondenceTest extends TestCase
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
            'counterparty_type' => 'organisation', 'title' => 'Interpretation', 'currency' => 'USD',
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000,
            'contract_status' => 'ACTIVE', 'status' => 'active',
        ]);
    }

    public function test_create_correspondence_from_contract_and_list(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/correspondence", [
            'title' => 'Contract transmittal', 'subject' => 'Signed interpretation contract', 'body' => 'Please find attached…',
        ])->assertCreated()
            ->assertJsonPath('data.contract_id', $contract->id)
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonPath('data.direction', 'outgoing');

        $po->getJson("/api/v1/contracts/{$contract->id}/correspondence")->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.title', 'Contract transmittal');
    }

    public function test_correspondence_creation_requires_permission(): void
    {
        $contract = $this->contract();
        [$staff] = $this->asStaff($this->tenant);

        $staff->postJson("/api/v1/contracts/{$contract->id}/correspondence", [
            'title' => 'X', 'subject' => 'Y',
        ])->assertForbidden();
    }
}
