<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\ContractException;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * P2 — portfolio risk analytics.
 */
class ContractRiskTest extends TestCase
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
            'start_date' => now()->subMonths(6)->toDateString(), 'end_date' => now()->addDays(400)->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'currency' => 'USD',
            'contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed',
        ], $overrides));
    }

    public function test_high_risk_contract_is_scored_and_surfaced_with_factors(): void
    {
        // Expiring soon + overdue deliverable + open critical exception + high value.
        $risky = $this->makeContract(['title' => 'Risky', 'end_date' => now()->addDays(10)->toDateString(), 'current_value' => 750000]);
        ContractDeliverable::create(['tenant_id' => $this->tenant->id, 'contract_id' => $risky->id, 'number' => 1, 'name' => 'Late', 'status' => 'in_progress', 'due_date' => now()->subDays(5)->toDateString()]);
        ContractException::create(['tenant_id' => $this->tenant->id, 'contract_id' => $risky->id, 'type' => 'start_before_execution', 'severity' => 'critical', 'title' => 'Started early', 'status' => 'open']);

        // A healthy contract that should not appear as at-risk.
        $this->makeContract(['title' => 'Healthy']);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $res = $po->getJson('/api/v1/contracts/reports/risk')->assertOk();

        $res->assertJsonPath('data.totals.contracts', 2)
            ->assertJsonPath('data.totals.at_risk', 1)
            ->assertJsonPath('data.levels.critical', 1);

        $this->assertEqualsWithDelta(750000, (float) $res->json('data.totals.at_risk_value'), 0.01);

        $top = collect($res->json('data.contracts'))->firstWhere('reference_number', $risky->reference_number)
            ?? collect($res->json('data.contracts'))->first();
        $this->assertSame('critical', $top['level']);
        $this->assertSame(100, $top['score']);
        $codes = collect($top['factors'])->pluck('code');
        $this->assertTrue($codes->contains('expiring_30'));
        $this->assertTrue($codes->contains('overdue_deliverables'));
        $this->assertTrue($codes->contains('open_critical_exception'));
        $this->assertTrue($codes->contains('high_value'));

        // Top factors tally is present.
        $factorCodes = collect($res->json('data.top_factors'))->pluck('code');
        $this->assertTrue($factorCodes->contains('overdue_deliverables'));
    }

    public function test_healthy_portfolio_reports_no_risk(): void
    {
        $this->makeContract(['title' => 'Fine']);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $res = $po->getJson('/api/v1/contracts/reports/risk')->assertOk();

        $res->assertJsonPath('data.totals.at_risk', 0)
            ->assertJsonPath('data.levels.low', 1)
            ->assertJsonPath('data.totals.at_risk_value', 0);
    }

    public function test_risk_requires_reporting_access(): void
    {
        [$staff] = $this->asStaff($this->tenant);
        $staff->getJson('/api/v1/contracts/reports/risk')->assertForbidden();
    }
}
