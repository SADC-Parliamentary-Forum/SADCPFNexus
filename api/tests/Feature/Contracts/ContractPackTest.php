<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * P1 — Contract Pack generation and supplier performance close-out feedback
 * (PRD §90, §32, §86-§87).
 */
class ContractPackTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(bool $withVendor = true): Contract
    {
        $vendorId = null;
        if ($withVendor) {
            $vendorId = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Acme', 'status' => 'approved', 'is_approved' => true, 'is_active' => true])->id;
        }

        $contract = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendorId, 'counterparty_type' => $withVendor ? 'organisation' : 'individual',
            'counterparty_name' => $withVendor ? 'Acme' : 'Jane Doe',
            'title' => 'Service', 'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'currency' => 'USD',
            'award_reference' => 'PROC/2026/001', 'contract_status' => 'COMPLETED', 'status' => 'completed', 'signature_status' => 'signed',
        ]);
        ContractDeliverable::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'number' => 1,
            'name' => 'Final Report', 'status' => 'accepted', 'responsible_party' => 'counterparty',
        ]);

        return $contract;
    }

    public function test_pack_index_enumerates_the_trail(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $res = $po->getJson("/api/v1/contracts/{$contract->id}/pack-index")->assertOk();
        $sections = collect($res->json('data'))->pluck('section');
        $this->assertTrue($sections->contains('Origin & procurement'));
        $this->assertTrue($sections->contains('Deliverables & acceptance'));
        $this->assertTrue($sections->contains('Lifecycle'));
    }

    public function test_pack_pdf_downloads(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $res = $po->get("/api/v1/contracts/{$contract->id}/pack");
        $res->assertOk();
        $this->assertStringContainsString('application/pdf', strtolower((string) $res->headers->get('content-type')));
    }

    public function test_supplier_performance_review_feeds_vendor_profile(): void
    {
        $contract = $this->contract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $res = $po->postJson("/api/v1/contracts/{$contract->id}/performance-review", [
            'delivery_score' => 5, 'quality_score' => 4, 'price_score' => 4,
            'compliance_score' => 5, 'communication_score' => 3, 'notes' => 'Reliable delivery.',
        ])->assertCreated();

        $this->assertDatabaseHas('vendor_performance_evaluations', [
            'contract_id' => $contract->id, 'vendor_id' => $contract->vendor_id, 'delivery_score' => 5,
        ]);
        // Overall score is the weighted computation exposed by the model.
        $this->assertGreaterThan(0, (float) $res->json('data.overall_score'));

        $po->getJson("/api/v1/contracts/{$contract->id}/performance-reviews")->assertOk()->assertJsonCount(1, 'data');
    }

    public function test_performance_review_requires_a_supplier(): void
    {
        // Individual counterparties (no vendor) have no supplier profile to feed.
        $contract = $this->contract(withVendor: false);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/performance-review", [
            'delivery_score' => 5, 'quality_score' => 5, 'price_score' => 5, 'compliance_score' => 5, 'communication_score' => 5,
        ])->assertStatus(422)->assertJsonValidationErrors('vendor');
    }
}
