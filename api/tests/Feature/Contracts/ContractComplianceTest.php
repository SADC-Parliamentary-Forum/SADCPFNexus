<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractComplianceDocument;
use App\Models\ContractComplianceRequirement;
use App\Models\Tenant;
use App\Modules\Contracts\Services\ContractComplianceService;
use App\Modules\Contracts\Services\ContractFinanceService;
use Tests\TestCase;

/**
 * Configurable compliance requirements (PRD §81–§82).
 */
class ContractComplianceTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(array $overrides = []): Contract
    {
        return Contract::create(array_merge([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'counterparty_type' => 'organisation', 'title' => 'C', 'currency' => 'USD',
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'ceiling_value' => 5000,
            'contract_status' => 'FULLY_EXECUTED', 'status' => 'draft', 'signature_status' => 'signed',
        ], $overrides));
    }

    private function requirement(array $overrides = []): ContractComplianceRequirement
    {
        return ContractComplianceRequirement::create(array_merge([
            'tenant_id' => $this->tenant->id, 'code' => 'tax_clearance', 'name' => 'Tax clearance certificate',
            'requires_expiry' => true, 'blocks_activation' => true, 'blocks_payment' => true, 'is_active' => true,
        ], $overrides));
    }

    public function test_requirement_crud_gated(): void
    {
        [$staff] = $this->asStaff($this->tenant);
        $staff->getJson('/api/v1/contracts/compliance/requirements')->assertForbidden();

        [$sg] = $this->asSG($this->tenant); // holds contract.manage_authority
        $id = $sg->postJson('/api/v1/contracts/compliance/requirements', [
            'code' => 'insurance', 'name' => 'Insurance certificate', 'blocks_payment' => true,
        ])->assertCreated()->json('data.id');
        $sg->getJson('/api/v1/contracts/compliance/requirements')->assertOk()->assertJsonFragment(['id' => $id]);
    }

    public function test_status_reports_missing_expired_satisfied(): void
    {
        $svc = app(ContractComplianceService::class);
        $this->requirement();
        $contract = $this->contract();

        // Missing.
        $this->assertTrue(collect($svc->status($contract))->firstWhere('code', 'tax_clearance')['missing']);

        // Expired document → not satisfied.
        $doc = ContractComplianceDocument::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'requirement_type' => 'tax_clearance',
            'name' => 'Tax cert', 'status' => 'verified', 'expiry_date' => now()->subDay()->toDateString(),
        ]);
        $this->assertTrue(collect($svc->status($contract->fresh()))->firstWhere('code', 'tax_clearance')['expired']);

        // Valid (future expiry) → satisfied.
        $doc->update(['expiry_date' => now()->addYear()->toDateString()]);
        $this->assertTrue(collect($svc->status($contract->fresh()))->firstWhere('code', 'tax_clearance')['satisfied']);
    }

    public function test_activation_blocked_when_required_compliance_missing(): void
    {
        $this->requirement(['blocks_activation' => true]);
        $contract = $this->contract();

        [$sg] = $this->asSG($this->tenant);
        $sg->postJson("/api/v1/contracts/{$contract->id}/activate")
            ->assertStatus(422)->assertJsonValidationErrors('compliance');
    }

    public function test_payment_ineligible_when_required_compliance_missing(): void
    {
        $this->requirement(['blocks_payment' => true, 'blocks_activation' => false]);
        $contract = $this->contract();

        $result = app(ContractFinanceService::class)->checkPaymentEligibility($contract, 100);
        $this->assertFalse($result['eligible']);
        $this->assertTrue(collect($result['reasons'])->contains(fn ($r) => str_contains($r, 'Tax clearance')));
    }
}
