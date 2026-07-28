<?php

namespace Tests\Feature\Stock;

use App\Models\Asset;
use App\Models\GoodsReceiptNote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\StockItem;
use App\Models\StockLocation;
use App\Models\StockRequest;
use App\Models\StockTransaction;
use App\Models\Tenant;
use App\Models\Vendor;
use Tests\TestCase;

class StockStoresPrdPhase1Test extends TestCase
{
    private function makeItem(Tenant $tenant, array $overrides = []): StockItem
    {
        return StockItem::create(array_merge([
            'tenant_id'              => $tenant->id,
            'item_code'              => 'STK-' . substr(uniqid(), -8),
            'name'                   => 'A4 Paper',
            'unit'                   => 'ream',
            'unit_cost'              => 5.5,
            'current_balance'        => 50,
            'quantity_reserved'      => 0,
            'quantity_quarantined'   => 0,
            'reorder_level'          => 10,
            'status'                 => 'active',
        ], $overrides));
    }

    public function test_cannot_directly_edit_balance_or_reserved(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 20]);

        $http->putJson("/api/v1/stock/items/{$item->id}", [
            'name'                  => 'A4 Paper Updated',
            'current_balance'       => 999,
            'quantity_reserved'     => 50,
            'quantity_quarantined'  => 50,
        ])->assertOk();

        $item->refresh();
        $this->assertSame(20, (int) $item->current_balance);
        $this->assertSame(0, (int) $item->quantity_reserved);
        $this->assertSame(0, (int) $item->quantity_quarantined);
        $this->assertSame('A4 Paper Updated', $item->name);
    }

    public function test_reservation_reduces_available_and_blocks_ordinary_out(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 10]);

        $create = $http->postJson('/api/v1/stock/requests', [
            'purpose' => 'Stationery',
            'submit'  => true,
            'lines'   => [
                ['stock_item_id' => $item->id, 'quantity_requested' => 8],
            ],
        ])->assertCreated();

        $requestId = $create->json('data.id');
        $http->postJson("/api/v1/stock/requests/{$requestId}/approve")->assertOk();

        $item->refresh();
        $this->assertSame(8, (int) $item->quantity_reserved);
        $this->assertSame(2, $item->available_quantity);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'out',
            'quantity'         => 5,
            'reason_code'      => 'issue',
            'transaction_date' => now()->toDateString(),
        ])->assertStatus(422);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'out',
            'quantity'         => 2,
            'reason_code'      => 'issue',
            'transaction_date' => now()->toDateString(),
        ])->assertCreated();

        $item->refresh();
        $this->assertSame(8, (int) $item->current_balance);
        $this->assertSame(8, (int) $item->quantity_reserved);
        $this->assertSame(0, $item->available_quantity);
    }

    public function test_request_approve_issue_flow_releases_reservation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 30]);

        $create = $http->postJson('/api/v1/stock/requests', [
            'purpose' => 'Meeting packs',
            'submit'  => true,
            'lines'   => [
                ['stock_item_id' => $item->id, 'quantity_requested' => 10],
            ],
        ])->assertCreated();

        $requestId = $create->json('data.id');
        $lineId = $create->json('data.lines.0.id');

        $http->postJson("/api/v1/stock/requests/{$requestId}/approve")->assertOk()
            ->assertJsonPath('data.status', StockRequest::STATUS_APPROVED);

        $issue = $http->postJson('/api/v1/stock/issues', [
            'stock_request_id'  => $requestId,
            'issued_to_user_id' => $admin->id,
            'issue_date'        => now()->toDateString(),
            'lines'             => [
                [
                    'stock_item_id'         => $item->id,
                    'stock_request_line_id' => $lineId,
                    'quantity'              => 10,
                ],
            ],
        ])->assertCreated();

        $issueId = $issue->json('data.id');
        $http->postJson("/api/v1/stock/issues/{$issueId}/acknowledge")->assertOk()
            ->assertJsonPath('data.status', 'acknowledged');

        $item->refresh();
        $this->assertSame(20, (int) $item->current_balance);
        $this->assertSame(0, (int) $item->quantity_reserved);
        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id' => $item->id,
            'type'          => StockTransaction::TYPE_OUT,
            'reason_code'   => StockTransaction::REASON_ISSUE,
            'quantity'      => -10,
        ]);
        $this->assertDatabaseHas('stock_requests', [
            'id'     => $requestId,
            'status' => StockRequest::STATUS_ISSUED,
        ]);
    }

    public function test_transfer_dispatch_and_receive_are_two_sided(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $from = StockLocation::create(['tenant_id' => $tenant->id, 'code' => 'MAIN', 'name' => 'Main']);
        $to = StockLocation::create(['tenant_id' => $tenant->id, 'code' => 'ANNEX', 'name' => 'Annex']);
        $item = $this->makeItem($tenant, [
            'current_balance'   => 15,
            'stock_location_id' => $from->id,
        ]);

        $create = $http->postJson('/api/v1/stock/transfers', [
            'from_location_id' => $from->id,
            'to_location_id'   => $to->id,
            'lines'            => [
                ['stock_item_id' => $item->id, 'quantity' => 5],
            ],
        ])->assertCreated();

        $transferId = $create->json('data.id');

        $http->postJson("/api/v1/stock/transfers/{$transferId}/dispatch")->assertOk()
            ->assertJsonPath('data.status', 'dispatched');

        $item->refresh();
        $this->assertSame(10, (int) $item->current_balance);

        $http->postJson("/api/v1/stock/transfers/{$transferId}/receive")->assertOk()
            ->assertJsonPath('data.status', 'received');

        $item->refresh();
        $this->assertSame(15, (int) $item->current_balance);
        $this->assertSame($to->id, (int) $item->stock_location_id);
        $this->assertSame(2, StockTransaction::where('stock_transfer_id', $transferId)->count());
    }

    public function test_stocktake_variance_requires_approval_before_adjustment(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 40]);

        $create = $http->postJson('/api/v1/stock/stocktakes', [
            'name'               => 'Blind count',
            'count_date'         => now()->toDateString(),
            'is_blind'           => true,
            'include_all_active' => true,
        ])->assertCreated();

        $stocktakeId = $create->json('data.id');
        $lineId = $create->json('data.lines.0.id');

        $http->putJson("/api/v1/stock/stocktakes/{$stocktakeId}/counts", [
            'lines' => [['id' => $lineId, 'counted_qty' => 38]],
        ])->assertOk();

        $http->postJson("/api/v1/stock/stocktakes/{$stocktakeId}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'pending_approval');

        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 40]);
        $this->assertSame(0, StockTransaction::where('reason_code', 'stocktake')->count());

        $http->postJson("/api/v1/stock/stocktakes/{$stocktakeId}/approve-variances")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 38]);
    }

    public function test_grn_classification_gateway_separates_fa_and_stock(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id, 'name' => 'Supply Co',
            'is_approved' => true, 'is_active' => true,
        ]);
        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Mixed buy', 'description' => 'Test', 'category' => 'goods',
            'estimated_value' => 6000, 'currency' => 'NAD', 'status' => 'awarded',
        ]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'reference_number' => 'PO-CLS' . uniqid(),
            'title' => 'Mixed',
            'total_amount' => 6000,
            'currency' => 'NAD',
            'status' => 'issued',
            'issued_at' => now(),
            'created_by' => $staff->id,
        ]);
        $poAsset = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'description' => 'Projector',
            'quantity' => 1, 'unit' => 'unit', 'unit_price' => 5000, 'total_price' => 5000,
        ]);
        $poStock = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'description' => 'Markers',
            'quantity' => 20, 'unit' => 'box', 'unit_price' => 50, 'total_price' => 1000,
        ]);
        $grn = GoodsReceiptNote::create([
            'tenant_id' => $tenant->id,
            'purchase_order_id' => $po->id,
            'received_by' => $staff->id,
            'received_date' => now()->toDateString(),
            'status' => 'pending',
        ]);
        $grnAsset = $grn->items()->create([
            'purchase_order_item_id' => $poAsset->id,
            'quantity_ordered' => 1, 'quantity_received' => 1, 'quantity_accepted' => 1,
        ]);
        $grnStock = $grn->items()->create([
            'purchase_order_item_id' => $poStock->id,
            'quantity_ordered' => 20, 'quantity_received' => 20, 'quantity_accepted' => 20,
        ]);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts/{$grn->id}/accept", [
            'handoff' => [
                [
                    'goods_receipt_item_id' => $grnAsset->id,
                    'type' => 'capital',
                    'name' => 'Conference Projector',
                    'quantity' => 1,
                ],
                [
                    'goods_receipt_item_id' => $grnStock->id,
                    'type' => 'consumable',
                    'name' => 'Whiteboard Markers',
                    'quantity' => 20,
                    'unit' => 'box',
                ],
                [
                    'goods_receipt_item_id' => $grnStock->id,
                    'type' => 'direct_expense',
                    'name' => 'should skip duplicate',
                    'quantity' => 1,
                ],
            ],
        ])->assertOk();

        $this->assertSame(1, Asset::where('tenant_id', $tenant->id)->count());
        $this->assertSame(1, StockItem::where('tenant_id', $tenant->id)->where('name', 'Whiteboard Markers')->count());
        $this->assertDatabaseHas('stock_transactions', [
            'type' => 'in',
            'quantity' => 20,
            'reason_code' => 'receipt',
            'goods_receipt_note_id' => $grn->id,
        ]);
        // Consumable path must not create FA rows for markers.
        $this->assertSame(0, Asset::where('name', 'Whiteboard Markers')->count());
    }

    public function test_pif_availability_endpoint_returns_available_math(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->makeItem($tenant, [
            'name' => 'Toner Cartridge',
            'item_code' => 'TONER-1',
            'current_balance' => 12,
            'quantity_reserved' => 4,
            'quantity_quarantined' => 2,
        ]);

        $http->getJson('/api/v1/stock/availability?q=Toner')
            ->assertOk()
            ->assertJsonPath('data.0.available', 6)
            ->assertJsonPath('data.0.on_hand', 12)
            ->assertJsonPath('data.0.reserved', 4)
            ->assertJsonPath('data.0.quarantined', 2);
    }

    public function test_write_off_requires_approval_before_ledger_out(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 10]);

        $http->postJson("/api/v1/stock/items/{$item->id}/quarantine", [
            'quantity' => 3,
            'notes' => 'Water damage',
        ])->assertOk();

        $item->refresh();
        $this->assertSame(3, (int) $item->quantity_quarantined);
        $this->assertSame(7, $item->available_quantity);

        $create = $http->postJson('/api/v1/stock/write-offs', [
            'stock_item_id'   => $item->id,
            'quantity'        => 3,
            'reason_code'     => 'damaged',
            'from_quarantine' => true,
        ])->assertCreated();

        $this->assertSame(10, (int) $item->fresh()->current_balance);

        $http->postJson('/api/v1/stock/write-offs/' . $create->json('data.id') . '/approve')
            ->assertOk();

        $item->refresh();
        $this->assertSame(7, (int) $item->current_balance);
        $this->assertSame(0, (int) $item->quantity_quarantined);
        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id' => $item->id,
            'reason_code'   => 'write_off',
            'quantity'      => -3,
        ]);
    }
}
