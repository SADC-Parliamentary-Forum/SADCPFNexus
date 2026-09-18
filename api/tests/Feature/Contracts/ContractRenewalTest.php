<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * P1 — extensions, renewals and auto-renewal deadline alerts (PRD §72–§74).
 */
class ContractRenewalTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function activeContract(array $overrides = []): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Acme', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create(array_merge([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'counterparty_name' => 'Acme',
            'title' => 'Service', 'start_date' => now()->subMonth()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'currency' => 'USD',
            'contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed',
        ], $overrides));
    }

    public function test_extension_changes_end_date_on_approval(): void
    {
        $contract = $this->activeContract();
        $newEnd = now()->addMonths(3)->toDateString();

        [$po] = $this->asProcurementOfficer($this->tenant);
        $extId = $po->postJson("/api/v1/contracts/{$contract->id}/extensions", [
            'proposed_end_date' => $newEnd, 'reason' => 'Meeting rescheduled',
        ])->assertCreated()->json('data.id');

        // Procurement cannot approve its own extension.
        $po->postJson("/api/v1/contracts/{$contract->id}/extensions/{$extId}/approve")->assertForbidden();

        [$sg] = $this->asSG($this->tenant);
        $sg->postJson("/api/v1/contracts/{$contract->id}/extensions/{$extId}/approve")->assertOk();

        $this->assertSame($newEnd, Contract::find($contract->id)->end_date->toDateString());
    }

    public function test_extension_rejects_earlier_end_date(): void
    {
        $contract = $this->activeContract();
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/extensions", [
            'proposed_end_date' => now()->subDay()->toDateString(), 'reason' => 'x',
        ])->assertStatus(422)->assertJsonValidationErrors('proposed_end_date');
    }

    public function test_renewal_requires_procurement_and_budget_confirmation(): void
    {
        $contract = $this->activeContract(['renewal_type' => 'renewable_multiple']);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $renewalId = $po->postJson("/api/v1/contracts/{$contract->id}/renewals", [
            'new_start_date' => now()->addMonth()->toDateString(),
            'new_end_date' => now()->addMonths(13)->toDateString(),
            'reason' => 'Continue services',
        ])->assertCreated()->json('data.id');

        [$sg] = $this->asSG($this->tenant);
        // Not validated/confirmed yet -> blocked.
        $sg->postJson("/api/v1/contracts/{$contract->id}/renewals/{$renewalId}/approve")->assertStatus(422);

        // Confirm and re-approve.
        \App\Models\ContractRenewal::find($renewalId)->update(['procurement_validated' => true, 'budget_confirmed' => true]);
        $sg->postJson("/api/v1/contracts/{$contract->id}/renewals/{$renewalId}/approve")->assertOk();

        $fresh = Contract::find($contract->id);
        $this->assertSame(1, $fresh->renewals_count);
        $this->assertSame(now()->addMonths(13)->toDateString(), $fresh->end_date->toDateString());
    }

    public function test_renewable_once_cannot_renew_twice(): void
    {
        $contract = $this->activeContract(['renewal_type' => 'renewable_once', 'renewals_count' => 1]);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $po->postJson("/api/v1/contracts/{$contract->id}/renewals", [
            'new_start_date' => now()->addMonth()->toDateString(),
            'new_end_date' => now()->addMonths(13)->toDateString(),
        ])->assertStatus(422);
    }

    public function test_auto_renewal_deadline_raises_alert_on_view(): void
    {
        // Auto-renew contract ending within the notice window.
        $contract = $this->activeContract([
            'auto_renew' => true, 'notice_period_days' => 30, 'end_date' => now()->addDays(10)->toDateString(),
        ]);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $res = $po->getJson("/api/v1/contracts/{$contract->id}")->assertOk();

        $exceptions = collect($res->json('data.exceptions'));
        $this->assertTrue($exceptions->contains(fn ($e) => $e['type'] === 'auto_renewal_deadline'));
    }
}
