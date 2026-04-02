<?php

namespace Tests\Feature\Procurement;

use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class GoodsReceiptTest extends TestCase
{
    private function makeIssuedPO(Tenant $tenant, int $requesterId): array
    {
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id, 'name' => 'Supply Co',
            'is_approved' => true, 'is_active' => true,
        ]);
        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $requesterId,
            'title' => 'Test', 'description' => 'Test', 'category' => 'goods', 'estimated_value' => 10000, 'currency' => 'NAD', 'status' => 'awarded',
        ]);
        $po = PurchaseOrder::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'reference_number'       => 'PO-TEST' . uniqid(),
            'title'                  => 'Test PO',
            'total_amount'           => 10000,
            'currency'               => 'NAD',
            'status'                 => 'issued',
            'issued_at'              => now(),
            'created_by'             => $requesterId,
        ]);
        $item = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'description'       => 'Item A',
            'quantity'          => 10,
            'unit'              => 'unit',
            'unit_price'        => 1000,
            'total_price'       => 10000,
        ]);
        return [$po, $item, $vendor];
    }

    public function test_can_record_goods_receipt_against_issued_po(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $item] = $this->makeIssuedPO($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'notes'         => 'All items delivered in good condition',
            'items'         => [
                ['purchase_order_item_id' => $item->id, 'quantity_received' => 10, 'quantity_accepted' => 10],
            ],
        ])->assertCreated()
          ->assertJsonPath('data.status', 'pending');

        $this->assertDatabaseHas('goods_receipt_notes', [
            'purchase_order_id' => $po->id,
        ]);
    }

    public function test_grn_reference_auto_generated(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $item] = $this->makeIssuedPO($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);
        $response = $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'items'         => [
                ['purchase_order_item_id' => $item->id, 'quantity_received' => 5, 'quantity_accepted' => 5],
            ],
        ]);
        $response->assertCreated();
        $this->assertStringStartsWith('GRN-', $response->json('data.reference_number'));
    }

    public function test_partial_receipt_allowed(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $item] = $this->makeIssuedPO($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'items'         => [
                ['purchase_order_item_id' => $item->id, 'quantity_received' => 5, 'quantity_accepted' => 5],
            ],
        ])->assertCreated();

        // PO should be partially_received
        $this->assertDatabaseHas('purchase_orders', ['id' => $po->id, 'status' => 'partially_received']);
    }

    public function test_grn_updates_po_status_to_received_when_fully_delivered(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $item] = $this->makeIssuedPO($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'items'         => [
                ['purchase_order_item_id' => $item->id, 'quantity_received' => 10, 'quantity_accepted' => 10],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('purchase_orders', ['id' => $po->id, 'status' => 'received']);
    }

    public function test_over_receipt_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $item] = $this->makeIssuedPO($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'items'         => [
                ['purchase_order_item_id' => $item->id, 'quantity_received' => 99, 'quantity_accepted' => 99],
            ],
        ])->assertUnprocessable();
    }

    public function test_only_authorised_roles_can_record_grn(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $item] = $this->makeIssuedPO($tenant, $staff->id);

        // Finance controller can also record GRN (has procurement.manage_po)
        [$http] = $this->asFinanceController($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'items'         => [['purchase_order_item_id' => $item->id, 'quantity_received' => 5, 'quantity_accepted' => 5]],
        ])->assertCreated();
    }

    public function test_cannot_receipt_against_draft_po(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create(['tenant_id' => $tenant->id, 'name' => 'V', 'is_approved' => true, 'is_active' => true]);
        $req    = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'T', 'description' => 'D', 'category' => 'goods', 'status' => 'awarded',
            'estimated_value' => 1000, 'currency' => 'NAD',
        ]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id, 'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id, 'reference_number' => 'PO-DRAFT1',
            'title' => 'Draft PO', 'total_amount' => 1000, 'currency' => 'NAD',
            'status' => 'draft', 'created_by' => $staff->id,
        ]);
        $item = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id, 'description' => 'Item', 'quantity' => 5,
            'unit' => 'unit', 'unit_price' => 200, 'total_price' => 1000,
        ]);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts", [
            'received_date' => now()->toDateString(),
            'items'         => [['purchase_order_item_id' => $item->id, 'quantity_received' => 5, 'quantity_accepted' => 5]],
        ])->assertUnprocessable();
    }
}
