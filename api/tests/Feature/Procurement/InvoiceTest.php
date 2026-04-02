<?php

namespace Tests\Feature\Procurement;

use App\Models\GoodsReceiptNote;
use App\Models\Invoice;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class InvoiceTest extends TestCase
{
    // ── Helpers ──────────────────────────────────────────────────────────────

    private function makeIssuedPO(Tenant $tenant, int $createdBy): array
    {
        $vendor = Vendor::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'OfficeSupplies Co',
            'is_approved' => true,
            'is_active'   => true,
        ]);

        $po = PurchaseOrder::create([
            'tenant_id'    => $tenant->id,
            'vendor_id'    => $vendor->id,
            'title'        => 'Office Supplies PO',
            'total_amount' => 12000,
            'currency'     => 'NAD',
            'status'       => 'received',
            'issued_at'    => now()->subDays(5),
            'created_by'   => $createdBy,
        ]);

        $item = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'description'       => 'Reams of Paper',
            'quantity'          => 100,
            'unit'              => 'ream',
            'unit_price'        => 120,
            'total_price'       => 12000,
        ]);

        $grn = GoodsReceiptNote::create([
            'tenant_id'        => $tenant->id,
            'purchase_order_id'=> $po->id,
            'received_by'      => $createdBy,
            'received_date'    => now()->subDays(2)->toDateString(),
            'status'           => 'accepted',
        ]);

        return [$po, $item, $grn, $vendor];
    }

    private function invoicePayload(PurchaseOrder $po, Vendor $vendor, ?GoodsReceiptNote $grn = null, array $overrides = []): array
    {
        return array_merge([
            'purchase_order_id'     => $po->id,
            'vendor_id'             => $vendor->id,
            'goods_receipt_note_id' => $grn?->id,
            'vendor_invoice_number' => 'INV-OS-2026-001',
            'invoice_date'          => now()->toDateString(),
            'due_date'              => now()->addDays(30)->toDateString(),
            'amount'                => 12000,
            'currency'              => 'NAD',
        ], $overrides);
    }

    // ── Create ────────────────────────────────────────────────────────────────

    public function test_finance_officer_can_create_invoice_against_accepted_grn(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $http->postJson('/api/v1/procurement/invoices', $this->invoicePayload($po, $vendor, $grn))
            ->assertCreated()
            ->assertJsonPath('data.purchase_order_id', $po->id)
            ->assertJsonPath('data.status', 'received');
    }

    public function test_invoice_reference_number_auto_generated(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $response = $http->postJson('/api/v1/procurement/invoices', $this->invoicePayload($po, $vendor, $grn))
            ->assertCreated();

        $this->assertStringStartsWith('INV-', $response->json('data.reference_number'));
    }

    public function test_invoice_amount_cannot_exceed_po_total(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $http->postJson('/api/v1/procurement/invoices', $this->invoicePayload($po, $vendor, $grn, ['amount' => 99999]))
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['amount']);
    }

    public function test_duplicate_vendor_invoice_number_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $payload = $this->invoicePayload($po, $vendor, $grn);
        $http->postJson('/api/v1/procurement/invoices', $payload)->assertCreated();
        $http->postJson('/api/v1/procurement/invoices', $payload)->assertUnprocessable();
    }

    public function test_staff_cannot_create_invoice(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id, 'vendor_id' => $vendor->id,
            'title' => 'PO', 'total_amount' => 1000, 'currency' => 'NAD',
            'status' => 'received', 'created_by' => null,
        ]);

        $http->postJson('/api/v1/procurement/invoices', [
            'purchase_order_id' => $po->id, 'vendor_id' => $vendor->id,
            'vendor_invoice_number' => 'X', 'invoice_date' => now()->toDateString(),
            'due_date' => now()->addDays(30)->toDateString(), 'amount' => 500, 'currency' => 'NAD',
        ])->assertForbidden();
    }

    // ── 3-Way Match ───────────────────────────────────────────────────────────

    public function test_three_way_match_passes_when_po_grn_invoice_align(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $response = $http->postJson('/api/v1/procurement/invoices', $this->invoicePayload($po, $vendor, $grn))
            ->assertCreated();

        $this->assertSame('matched', $response->json('data.match_status'));
    }

    public function test_three_way_match_flags_variance_on_amount_mismatch(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $response = $http->postJson('/api/v1/procurement/invoices', $this->invoicePayload($po, $vendor, $grn, ['amount' => 11000]))
            ->assertCreated();

        $this->assertSame('variance', $response->json('data.match_status'));
    }

    // ── Approve / Reject ──────────────────────────────────────────────────────

    public function test_finance_officer_can_approve_matched_invoice(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $invoice = Invoice::create(array_merge($this->invoicePayload($po, $vendor, $grn), [
            'tenant_id'        => $tenant->id,
            'reference_number' => 'INV-TEST0001',
            'status'           => 'received',
            'match_status'     => 'matched',
        ]));

        $http->postJson("/api/v1/procurement/invoices/{$invoice->id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_finance_officer_can_reject_invoice_with_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $invoice = Invoice::create(array_merge($this->invoicePayload($po, $vendor, $grn), [
            'tenant_id'        => $tenant->id,
            'reference_number' => 'INV-TEST0002',
            'status'           => 'received',
            'match_status'     => 'variance',
        ]));

        $http->postJson("/api/v1/procurement/invoices/{$invoice->id}/reject", ['reason' => 'Amount mismatch'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');
    }

    public function test_reject_requires_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asFinanceController($tenant);
        [$po, , $grn, $vendor] = $this->makeIssuedPO($tenant, $user->id);

        $invoice = Invoice::create(array_merge($this->invoicePayload($po, $vendor, $grn), [
            'tenant_id'        => $tenant->id,
            'reference_number' => 'INV-TEST0003',
            'status'           => 'received',
            'match_status'     => 'pending',
        ]));

        $http->postJson("/api/v1/procurement/invoices/{$invoice->id}/reject", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reason']);
    }

    public function test_only_finance_can_approve_invoice(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id, 'vendor_id' => $vendor->id,
            'title' => 'PO', 'total_amount' => 1000, 'currency' => 'NAD',
            'status' => 'received', 'created_by' => null,
        ]);
        $invoice = Invoice::create([
            'tenant_id' => $tenant->id, 'purchase_order_id' => $po->id, 'vendor_id' => $vendor->id,
            'reference_number' => 'INV-TEST0004', 'vendor_invoice_number' => 'EXT-001',
            'invoice_date' => now()->toDateString(), 'due_date' => now()->addDays(30)->toDateString(),
            'amount' => 500, 'currency' => 'NAD', 'status' => 'received', 'match_status' => 'pending',
        ]);

        $http->postJson("/api/v1/procurement/invoices/{$invoice->id}/approve")
            ->assertForbidden();
    }

    // ── Tenant Isolation ──────────────────────────────────────────────────────

    public function test_tenant_isolation_on_invoices(): void
    {
        $t1 = Tenant::factory()->create();
        $t2 = Tenant::factory()->create();
        [$http1] = $this->asFinanceController($t1);

        $vendor2 = Vendor::create(['tenant_id' => $t2->id, 'name' => 'ForeignCo', 'is_approved' => true, 'is_active' => true]);
        $po2 = PurchaseOrder::create([
            'tenant_id' => $t2->id, 'vendor_id' => $vendor2->id,
            'title' => 'PO', 'total_amount' => 1000, 'currency' => 'NAD',
            'status' => 'received', 'created_by' => null,
        ]);
        $invoice2 = Invoice::create([
            'tenant_id' => $t2->id, 'purchase_order_id' => $po2->id, 'vendor_id' => $vendor2->id,
            'reference_number' => 'INV-T2-0001', 'vendor_invoice_number' => 'EXT-T2-001',
            'invoice_date' => now()->toDateString(), 'due_date' => now()->addDays(30)->toDateString(),
            'amount' => 1000, 'currency' => 'NAD', 'status' => 'received', 'match_status' => 'pending',
        ]);

        $http1->getJson("/api/v1/procurement/invoices/{$invoice2->id}")->assertNotFound();
    }
}
