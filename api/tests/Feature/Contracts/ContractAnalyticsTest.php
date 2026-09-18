<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractAmendment;
use App\Models\ContractDeliverable;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * P2 — management analytics dashboards (PRD §101).
 */
class ContractAnalyticsTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function makeContract(array $overrides = []): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V'.uniqid(), 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create(array_merge([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'C',
            'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addDays(20)->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'currency' => 'USD',
            'contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed',
        ], $overrides));
    }

    public function test_analytics_summary_reports_portfolio_metrics(): void
    {
        $dept = Department::create(['tenant_id' => $this->tenant->id, 'name' => 'Programmes', 'code' => 'PRG']);
        $c1 = $this->makeContract(['department_id' => $dept->id, 'current_value' => 5000, 'end_date' => now()->addDays(20)->toDateString(), 'signed_at' => now()]);
        $c2 = $this->makeContract(['department_id' => $dept->id, 'current_value' => 3000, 'end_date' => now()->addDays(75)->toDateString()]);
        ContractAmendment::create(['tenant_id' => $this->tenant->id, 'contract_id' => $c1->id, 'sequence' => 1, 'type' => 'value', 'revised_value' => 6000, 'is_material' => true, 'status' => 'approved']);
        ContractDeliverable::create(['tenant_id' => $this->tenant->id, 'contract_id' => $c1->id, 'number' => 1, 'name' => 'D', 'status' => 'accepted', 'due_date' => now()->addDay()->toDateString(), 'accepted_at' => now()]);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $res = $po->getJson('/api/v1/contracts/reports/analytics')->assertOk();

        $res->assertJsonPath('data.totals.contracts', 2)
            ->assertJsonPath('data.amendment_frequency.total_amendments', 1)
            ->assertJsonPath('data.amendment_frequency.contracts_with_amendments', 1)
            ->assertJsonPath('data.on_time_deliverable_rate.rate', 100);

        // Department grouping present.
        $depts = collect($res->json('data.value_by_department'));
        $this->assertTrue($depts->contains(fn ($d) => $d['label'] === 'Programmes' && $d['value'] == 8000));

        // Expiry forecast has the standard buckets.
        $buckets = collect($res->json('data.expiry_forecast'))->pluck('bucket');
        $this->assertTrue($buckets->contains('0-30 days'));
        $this->assertTrue($buckets->contains('61-90 days'));
    }

    public function test_analytics_requires_reporting_access(): void
    {
        [$staff] = $this->asStaff($this->tenant);
        $staff->getJson('/api/v1/contracts/reports/analytics')->assertForbidden();
    }
}
