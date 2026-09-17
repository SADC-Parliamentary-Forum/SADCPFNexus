<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractException;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * WS6 — reports, exception register and per-contract audit trail.
 */
class ContractReportTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function seedContracts(int $creator): void
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Acme', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        foreach (['ACTIVE' => 5000, 'DRAFT' => 2000] as $status => $value) {
            Contract::create([
                'tenant_id' => $this->tenant->id, 'created_by' => $creator, 'vendor_id' => $vendor->id,
                'counterparty_type' => 'organisation', 'counterparty_name' => 'Acme',
                'title' => "Contract {$status}", 'start_date' => now()->toDateString(), 'end_date' => now()->addYear()->toDateString(),
                'value' => $value, 'original_value' => $value, 'current_value' => $value, 'currency' => 'USD',
                'contract_status' => $status, 'status' => strtolower($status),
            ]);
        }
    }

    public function test_register_report_json_and_csv(): void
    {
        [$http, $officer] = $this->asProcurementOfficer($this->tenant);
        $this->seedContracts($officer->id);

        $http->getJson('/api/v1/contracts/reports?type=register')->assertOk()
            ->assertJsonPath('type', 'register')
            ->assertJsonCount(2, 'data');

        $csv = $http->get('/api/v1/contracts/reports?type=register&format=csv');
        $csv->assertOk();
        $this->assertStringContainsString('text/csv', $csv->headers->get('content-type'));
    }

    public function test_financial_report(): void
    {
        [$http, $officer] = $this->asProcurementOfficer($this->tenant);
        $this->seedContracts($officer->id);

        $http->getJson('/api/v1/contracts/reports?type=financial')->assertOk()
            ->assertJsonPath('type', 'financial')
            ->assertJsonCount(2, 'data');
    }

    public function test_exception_register(): void
    {
        [$http, $officer] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $officer->id, 'vendor_id' => $vendor->id,
            'counterparty_type' => 'organisation', 'title' => 'C', 'start_date' => now()->toDateString(),
            'end_date' => now()->addYear()->toDateString(), 'value' => 1, 'currency' => 'USD',
            'contract_status' => 'DRAFT', 'status' => 'draft',
        ]);
        ContractException::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'type' => 'missing_procurement_reference',
            'severity' => 'high', 'title' => 'No procurement reference', 'status' => 'open',
        ]);

        $http->getJson('/api/v1/contracts/reports/exceptions')->assertOk()
            ->assertJsonFragment(['type' => 'missing_procurement_reference']);
    }

    public function test_contract_audit_trail(): void
    {
        [$http] = $this->asProcurementOfficer($this->tenant);
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        $id = $http->postJson('/api/v1/contracts', [
            'counterparty_type' => 'organisation', 'vendor_id' => $vendor->id, 'title' => 'Audited',
            'start_date' => now()->addDay()->toDateString(), 'end_date' => now()->addDays(9)->toDateString(),
            'value' => 100, 'currency' => 'USD',
        ])->assertCreated()->json('data.id');

        $http->getJson("/api/v1/contracts/{$id}/audit")->assertOk()
            ->assertJsonFragment(['event' => 'contract.created']);
    }
}
