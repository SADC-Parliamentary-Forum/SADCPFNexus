<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * P1 — framework agreements & call-offs (PRD §79).
 */
class ContractFrameworkTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function framework(float $ceiling = 100000, ?string $end = null): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Framework Supplier', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'counterparty_name' => 'Framework Supplier',
            'title' => 'IT Services Framework', 'start_date' => now()->subMonth()->toDateString(),
            'end_date' => $end ?? now()->addYear()->toDateString(),
            'value' => 0, 'original_value' => 0, 'current_value' => 0, 'currency' => 'USD',
            'is_framework' => true, 'framework_ceiling' => $ceiling,
            'contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed',
        ]);
    }

    public function test_call_off_created_and_utilisation_tracked(): void
    {
        $framework = $this->framework(100000);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$framework->id}/call-offs", [
            'title' => 'Call-Off 001', 'start_date' => now()->toDateString(),
            'end_date' => now()->addMonths(2)->toDateString(), 'value' => 30000,
        ])->assertCreated()->assertJsonPath('data.origin_type', 'framework');

        $res = $po->getJson("/api/v1/contracts/{$framework->id}/call-offs")->assertOk();
        $res->assertJsonPath('utilisation.used', 30000)
            ->assertJsonPath('utilisation.remaining', 70000)
            ->assertJsonPath('utilisation.call_off_count', 1);
    }

    public function test_call_off_cannot_exceed_framework_ceiling(): void
    {
        $framework = $this->framework(50000);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$framework->id}/call-offs", [
            'title' => 'Too big', 'start_date' => now()->toDateString(),
            'end_date' => now()->addMonths(2)->toDateString(), 'value' => 60000,
        ])->assertStatus(422)->assertJsonValidationErrors('value');
    }

    public function test_call_off_cannot_exceed_framework_term(): void
    {
        $framework = $this->framework(100000, now()->addMonths(3)->toDateString());
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$framework->id}/call-offs", [
            'title' => 'Too long', 'start_date' => now()->toDateString(),
            'end_date' => now()->addMonths(9)->toDateString(), 'value' => 1000,
        ])->assertStatus(422)->assertJsonValidationErrors('end_date');
    }

    public function test_call_off_requires_a_framework_parent(): void
    {
        // A non-framework contract cannot host call-offs.
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $plain = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'Plain',
            'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString(),
            'value' => 1000, 'currency' => 'USD', 'contract_status' => 'ACTIVE', 'status' => 'active',
        ]);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->postJson("/api/v1/contracts/{$plain->id}/call-offs", [
            'title' => 'x', 'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(), 'value' => 10,
        ])->assertStatus(422);
    }
}
