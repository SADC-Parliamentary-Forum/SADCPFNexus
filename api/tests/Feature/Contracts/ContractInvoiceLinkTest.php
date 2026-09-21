<?php

namespace Tests\Feature\Contracts;

use App\Models\Contract;
use App\Models\ContractDeliverable;
use App\Models\ContractPaymentSchedule;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

/**
 * Invoice ↔ contract / milestone / deliverable linking (PRD §58).
 */
class ContractInvoiceLinkTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function contract(): Contract
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'V', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);

        return Contract::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
            'vendor_id' => $vendor->id, 'counterparty_type' => 'organisation', 'title' => 'C', 'currency' => 'USD',
            'start_date' => now()->toDateString(), 'end_date' => now()->addMonth()->toDateString(),
            'value' => 5000, 'original_value' => 5000, 'current_value' => 5000, 'ceiling_value' => 5000,
            'contract_status' => 'ACTIVE', 'status' => 'active',
        ]);
    }

    private function invoice(): Invoice
    {
        $vendor = Vendor::create(['tenant_id' => $this->tenant->id, 'name' => 'InvVendor', 'status' => 'approved', 'is_approved' => true, 'is_active' => true]);
        $po = PurchaseOrder::create([
            'tenant_id' => $this->tenant->id, 'vendor_id' => $vendor->id, 'title' => 'PO', 'total_amount' => 1500,
            'currency' => 'USD', 'status' => 'received', 'issued_at' => now()->subDay(), 'created_by' => $this->makeProcurementOfficer($this->tenant)->id,
        ]);

        return Invoice::create([
            'tenant_id' => $this->tenant->id, 'purchase_order_id' => $po->id, 'vendor_id' => $vendor->id,
            'vendor_invoice_number' => 'VINV-'.uniqid(), 'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(), 'amount' => 1500, 'currency' => 'USD', 'status' => 'received',
        ]);
    }

    public function test_link_invoice_to_contract_and_milestone_then_list(): void
    {
        $contract = $this->contract();
        $deliverable = ContractDeliverable::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'number' => 1, 'name' => 'Report', 'status' => 'accepted']);
        $milestone = ContractPaymentSchedule::create(['tenant_id' => $this->tenant->id, 'contract_id' => $contract->id, 'name' => 'Final', 'basis' => 'milestone', 'amount' => 1500, 'currency' => 'USD', 'trigger_type' => 'deliverable', 'trigger_deliverable_id' => $deliverable->id, 'status' => 'pending']);
        $invoice = $this->invoice();

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->postJson("/api/v1/contracts/{$contract->id}/invoices/{$invoice->id}/link", ['contract_payment_schedule_id' => $milestone->id])
            ->assertOk();

        $this->assertSame($contract->id, Invoice::find($invoice->id)->contract_id);
        $this->assertSame($milestone->id, Invoice::find($invoice->id)->contract_payment_schedule_id);

        $po->getJson("/api/v1/contracts/{$contract->id}/invoices")->assertOk()
            ->assertJsonCount(1, 'data')
            ->assertJsonPath('data.0.contract_payment_schedule.trigger_deliverable.name', 'Report');
    }

    public function test_cannot_link_milestone_from_another_contract(): void
    {
        $contract = $this->contract();
        $other = $this->contract();
        $foreignMilestone = ContractPaymentSchedule::create(['tenant_id' => $this->tenant->id, 'contract_id' => $other->id, 'name' => 'X', 'basis' => 'fixed', 'amount' => 100, 'currency' => 'USD', 'trigger_type' => 'fixed', 'status' => 'pending']);
        $invoice = $this->invoice();

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->postJson("/api/v1/contracts/{$contract->id}/invoices/{$invoice->id}/link", ['contract_payment_schedule_id' => $foreignMilestone->id])
            ->assertStatus(422);
    }

    public function test_unlink_invoice(): void
    {
        $contract = $this->contract();
        $invoice = $this->invoice();
        $invoice->update(['contract_id' => $contract->id]);

        [$po] = $this->asProcurementOfficer($this->tenant);
        $po->deleteJson("/api/v1/contracts/{$contract->id}/invoices/{$invoice->id}/link")->assertOk();
        $this->assertNull(Invoice::find($invoice->id)->contract_id);
    }
}
