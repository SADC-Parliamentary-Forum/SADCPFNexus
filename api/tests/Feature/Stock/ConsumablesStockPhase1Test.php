<?php

namespace Tests\Feature\Stock;

use App\Models\Notification;
use App\Models\StockItem;
use App\Models\StockLocation;
use App\Models\Stocktake;
use App\Models\StockTransaction;
use App\Models\StockUnit;
use App\Models\Tenant;
use Tests\TestCase;

class ConsumablesStockPhase1Test extends TestCase
{
    private function makeItem(Tenant $tenant, array $overrides = []): StockItem
    {
        return StockItem::create(array_merge([
            'tenant_id'       => $tenant->id,
            'item_code'       => 'STK-' . substr(uniqid(), -8),
            'name'            => 'A4 Paper',
            'unit'            => 'ream',
            'unit_cost'       => 5.5,
            'current_balance' => 50,
            'reorder_level'   => 10,
            'status'          => 'active',
        ], $overrides));
    }

    public function test_admin_can_create_unit_and_location(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->postJson('/api/v1/stock/units', [
            'code' => 'ream',
            'name' => 'Ream',
        ])->assertCreated()->assertJsonPath('data.code', 'ream');

        $http->postJson('/api/v1/stock/locations', [
            'code' => 'MAIN',
            'name' => 'Main Store',
        ])->assertCreated()->assertJsonPath('data.code', 'MAIN');
    }

    public function test_dashboard_returns_kpis(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->makeItem($tenant, ['current_balance' => 3, 'reorder_level' => 10]);

        $http->getJson('/api/v1/stock/dashboard')
            ->assertOk()
            ->assertJsonPath('data.active_items', 1)
            ->assertJsonPath('data.low_stock_count', 1);
    }

    public function test_reason_code_recorded_on_stock_out(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 20]);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'out',
            'quantity'         => 2,
            'reason_code'      => 'damaged',
            'reason'           => 'Water damage',
            'transaction_date' => now()->toDateString(),
        ])->assertCreated()->assertJsonPath('data.reason_code', 'damaged');

        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id' => $item->id,
            'reason_code'   => 'damaged',
            'type'          => 'out',
        ]);
    }

    public function test_stocktake_complete_posts_variance_adjustment(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['current_balance' => 40]);

        $create = $http->postJson('/api/v1/stock/stocktakes', [
            'name'               => 'Q3 Count',
            'count_date'         => now()->toDateString(),
            'include_all_active' => true,
        ])->assertCreated();

        $stocktakeId = $create->json('data.id');
        $lineId = $create->json('data.lines.0.id');

        $http->putJson("/api/v1/stock/stocktakes/{$stocktakeId}/counts", [
            'lines' => [
                ['id' => $lineId, 'counted_qty' => 35],
            ],
        ])->assertOk();

        $http->postJson("/api/v1/stock/stocktakes/{$stocktakeId}/complete")
            ->assertOk()
            ->assertJsonPath('data.status', 'completed');

        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 35]);
        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id' => $item->id,
            'type'          => 'adjustment',
            'quantity'      => -5,
            'reason_code'   => 'stocktake',
        ]);
        $this->assertDatabaseHas('stocktakes', [
            'id'           => $stocktakeId,
            'status'       => Stocktake::STATUS_COMPLETED,
            'completed_by' => $admin->id,
        ]);
    }

    public function test_crossing_reorder_level_creates_low_stock_notification(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, [
            'current_balance' => 12,
            'reorder_level'   => 10,
        ]);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'out',
            'quantity'         => 3,
            'reason_code'      => 'issue',
            'transaction_date' => now()->toDateString(),
        ])->assertCreated();

        $this->assertTrue(
            Notification::where('user_id', $admin->id)
                ->where('trigger', 'stock.low_stock')
                ->exists()
        );
    }

    public function test_item_can_link_unit_and_location(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $unit = StockUnit::create([
            'tenant_id' => $tenant->id,
            'code'      => 'box',
            'name'      => 'Box',
        ]);
        $location = StockLocation::create([
            'tenant_id' => $tenant->id,
            'code'      => 'STORE-A',
            'name'      => 'Store A',
        ]);

        $http->postJson('/api/v1/stock/items', [
            'item_code'         => 'STK-LINK-1',
            'name'              => 'Toner Box',
            'unit'              => 'box',
            'stock_unit_id'     => $unit->id,
            'stock_location_id' => $location->id,
            'opening_balance'   => 5,
            'reorder_level'     => 2,
        ])->assertCreated()
          ->assertJsonPath('data.stock_unit_id', $unit->id)
          ->assertJsonPath('data.stock_location_id', $location->id)
          ->assertJsonPath('data.current_balance', 5);

        $this->assertDatabaseHas('stock_transactions', [
            'type'     => StockTransaction::TYPE_IN,
            'quantity' => 5,
        ]);
    }
}
