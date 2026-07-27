<?php

namespace Tests\Feature\Procurement;

use App\Models\Asset;
use App\Models\GoodsReceiptNote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockCategory;
use App\Models\StockItem;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class GoodsReceiptHandoffTest extends TestCase
{
    private function makePendingGrn(Tenant $tenant, int $requesterId): array
    {
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id, 'name' => 'Supply Co',
            'is_approved' => true, 'is_active' => true,
        ]);
        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $requesterId,
            'title' => 'Handoff Test', 'description' => 'Test', 'category' => 'goods',
            'estimated_value' => 10000, 'currency' => 'NAD', 'status' => 'awarded',
        ]);
        $po = PurchaseOrder::create([
            'tenant_id'              => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id'              => $vendor->id,
            'reference_number'       => 'PO-HANDOFF' . uniqid(),
            'title'                  => 'Handoff PO',
            'total_amount'           => 10000,
            'currency'               => 'NAD',
            'status'                 => 'issued',
            'issued_at'              => now(),
            'created_by'             => $requesterId,
        ]);
        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'description'       => 'Laptop Dell XPS',
            'quantity'          => 2,
            'unit'              => 'unit',
            'unit_price'        => 5000,
            'total_price'       => 10000,
        ]);
        $grn = GoodsReceiptNote::create([
            'tenant_id'         => $tenant->id,
            'purchase_order_id' => $po->id,
            'received_by'       => $requesterId,
            'received_date'     => now()->toDateString(),
            'status'            => 'pending',
        ]);
        $grnItem = $grn->items()->create([
            'purchase_order_item_id' => $poItem->id,
            'quantity_ordered'       => 2,
            'quantity_received'      => 2,
            'quantity_accepted'      => 2,
        ]);

        return [$po, $grn, $grnItem, $req, $vendor];
    }

    public function test_accept_grn_with_capital_handoff_creates_draft_asset(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $grn, $grnItem, $req] = $this->makePendingGrn($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts/{$grn->id}/accept", [
            'handoff' => [
                [
                    'goods_receipt_item_id' => $grnItem->id,
                    'type'                  => 'fixed_asset',
                    'name'                  => 'Dell XPS Laptop',
                    'category'              => 'equipment',
                ],
            ],
        ])->assertOk()
          ->assertJsonPath('data.status', 'accepted');

        $this->assertDatabaseHas('assets', [
            'tenant_id'              => $tenant->id,
            'name'                   => 'Dell XPS Laptop #1',
            'category'               => 'equipment',
            'status'                 => 'pending',
            'purchase_order_id'      => $po->id,
            'procurement_request_id' => $req->id,
            'goods_receipt_note_id'  => $grn->id,
        ]);

        // One physical unit per accepted qty (PO/GRN line accepted = 2)
        $this->assertSame(2, Asset::where('goods_receipt_note_id', $grn->id)->count());

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'procurement.grn_handoff',
        ]);
    }

    public function test_accept_grn_with_stock_handoff_creates_stock_item(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $grn, $grnItem, $req] = $this->makePendingGrn($tenant, $staff->id);

        $stockCategory = StockCategory::create([
            'tenant_id'   => $tenant->id,
            'name'        => 'Consumables',
            'code'        => 'consumables',
            'description' => 'General consumables',
            'is_active'   => true,
        ]);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts/{$grn->id}/accept", [
            'handoff' => [
                [
                    'goods_receipt_item_id' => $grnItem->id,
                    'type'                  => 'stock',
                    'name'                  => 'Toner Cartridge',
                    'quantity'              => 10,
                    'unit'                  => 'each',
                    'stock_category_id'     => $stockCategory->id,
                ],
            ],
        ])->assertOk();

        $this->assertDatabaseHas('stock_items', [
            'tenant_id'              => $tenant->id,
            'name'                   => 'Toner Cartridge',
            'procurement_request_id' => $req->id,
            'purchase_order_id'      => $po->id,
            'current_balance'        => 10,
        ]);

        $item = StockItem::where('name', 'Toner Cartridge')->where('tenant_id', $tenant->id)->first();
        $this->assertNotNull($item);
        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id' => $item->id,
            'type'          => 'in',
            'quantity'      => 10,
            'balance_after' => 10,
        ]);
    }

    public function test_accept_grn_without_handoff_still_works(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        [$po, $grn] = $this->makePendingGrn($tenant, $staff->id);

        [$http] = $this->asProcurementOfficer($tenant);

        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts/{$grn->id}/accept")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $this->assertSame(0, Asset::count());
        $this->assertSame(0, StockItem::count());
    }
}
