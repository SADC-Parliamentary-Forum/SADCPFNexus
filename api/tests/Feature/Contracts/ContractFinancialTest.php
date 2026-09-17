<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\ContractPaymentSchedule;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * WS5 — financial ledger, payment controls, deliverable acceptance, amendments
 * and close-out. Covers release-blocking acceptance tests §122, §123, §124, §126.
 */
class ContractFinancialTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function executedContract(float $value = 10000, float $paid = 8000): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'Acme', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $contract = Contract::create([
            'tenant_id' => $this->tenant->id,
            'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'counterparty_name' => 'Acme',
            'title' => 'Service', 'start_date' => now()->subDay()->toDateString(), 'end_date' => now()->addMonths(6)->toDateString(),
            'value' => $value, 'original_value' => $value, 'current_value' => $value, 'ceiling_value' => $value,
            'currency' => 'USD', 'contract_status' => 'ACTIVE', 'status' => 'active', 'signature_status' => 'signed',
        ]);
        ContractPaymentSchedule::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'name' => 'Signing',
            'basis' => 'fixed', 'amount' => $paid, 'amount_paid' => $paid, 'status' => 'paid', 'currency' => 'USD',
        ]);

        return $contract;
    }

    public function test_ledger_reports_remaining_balance(): void
    {
        $contract = $this->executedContract(10000, 8000);
        [$http] = $this->asProcurementOfficer($this->tenant);

        $http->getJson("/api/v1/contracts/{$contract->id}/ledger")->assertOk()
            ->assertJsonPath('data.ledger.current', 10000)
            ->assertJsonPath('data.ledger.paid', 8000)
            ->assertJsonPath('data.ledger.remaining', 2000);
    }

    public function test_payment_blocked_when_it_would_exceed_ceiling(): void
    {
        // AT §124 — value 10k, 8k paid; a further 3k invoice overruns by 1k.
        $contract = $this->executedContract(10000, 8000);
        [$http] = $this->asFinanceController($this->tenant);

        $http->postJson("/api/v1/contracts/{$contract->id}/check-payment", ['amount' => 3000])
            ->assertOk()
            ->assertJsonPath('data.eligible', false)
            ->assertJsonPath('data.overrun', 1000);
    }

    public function test_milestone_payment_requires_accepted_deliverable(): void
    {
        // AT §123 — a milestone gated on an unaccepted deliverable is not payable.
        $contract = $this->executedContract(10000, 0);
        $deliverable = ContractDeliverable::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'number' => 1,
            'name' => 'Draft Report', 'status' => 'submitted', 'responsible_party' => 'counterparty',
        ]);
        $schedule = ContractPaymentSchedule::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'name' => 'Draft Report Payment',
            'basis' => 'milestone', 'amount' => 3000, 'status' => 'not_due', 'currency' => 'USD',
            'trigger_deliverable_id' => $deliverable->id,
        ]);

        [$finance] = $this->asFinanceController($this->tenant);
        $finance->postJson("/api/v1/contracts/{$contract->id}/check-payment", ['amount' => 3000, 'payment_schedule_id' => $schedule->id])
            ->assertOk()->assertJsonPath('data.eligible', false);

        // Owner accepts the deliverable -> milestone becomes payable.
        [$po, $officer] = $this->asProcurementOfficer($this->tenant);
        $po->postJson("/api/v1/contracts/{$contract->id}/deliverables/{$deliverable->id}/review", ['decision' => 'accept'])->assertOk();

        $this->assertSame('eligible', $schedule->fresh()->status);
        $finance = $this->asUser($this->makeFinanceController($this->tenant));
        $finance->postJson("/api/v1/contracts/{$contract->id}/check-payment", ['amount' => 3000, 'payment_schedule_id' => $schedule->id])
            ->assertOk()->assertJsonPath('data.eligible', true);
    }

    public function test_amendment_recalculates_value_and_flags_material(): void
    {
        // AT §122 — original 9,500 + 2,000 => revised 11,500, re-evaluated.
        $contract = $this->executedContract(9500, 0);
        [$po] = $this->asProcurementOfficer($this->tenant);

        $res = $po->postJson("/api/v1/contracts/{$contract->id}/amendments", [
            'type' => 'value', 'reason' => 'Additional scope', 'value_delta' => 2000,
        ])->assertCreated();

        $res->assertJsonPath('comparison.value.revised', 11500)
            ->assertJsonPath('comparison.is_material', true)
            ->assertJsonPath('comparison.requires_management_authorisation', true);

        $amendmentId = $res->json('data.id');
        $this->assertSame('AMENDMENT_PENDING', Contract::find($contract->id)->contract_status);

        // Procurement cannot approve its own amendment; SG (authority) applies it.
        $po->postJson("/api/v1/contracts/{$contract->id}/amendments/{$amendmentId}/approve")->assertForbidden();

        [$sg] = $this->asSG($this->tenant);
        $sg->postJson("/api/v1/contracts/{$contract->id}/amendments/{$amendmentId}/approve")->assertOk();
        $this->assertEquals(11500, (float) Contract::find($contract->id)->current_value);
    }

    public function test_closeout_blocked_by_unresolved_deliverable(): void
    {
        // AT §126 — cannot close while a deliverable is unresolved.
        $contract = $this->executedContract(10000, 0);
        ContractDeliverable::create([
            'tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'number' => 1,
            'name' => 'Final Report', 'status' => 'in_progress', 'responsible_party' => 'counterparty',
        ]);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->postJson("/api/v1/contracts/{$contract->id}/close")->assertStatus(422)->assertJsonValidationErrors('closeout');

        // Once accepted, close-out succeeds and produces a certificate.
        $deliverable = $contract->deliverables()->first();
        $po->postJson("/api/v1/contracts/{$contract->id}/deliverables/{$deliverable->id}/review", ['decision' => 'accept'])->assertOk();
        $po->postJson("/api/v1/contracts/{$contract->id}/close")->assertOk()
            ->assertJsonPath('data.contract_status', 'CLOSED')
            ->assertJsonPath('certificate.final_value', 10000);
    }
}
