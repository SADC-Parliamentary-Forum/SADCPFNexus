<?php

namespace Tests\Feature\Stock;

use App\Models\StockItem;
use App\Models\Stocktake;
use App\Models\StocktakeLine;
use App\Models\Tenant;
use Tests\TestCase;

class StocktakeOfflineSyncTest extends TestCase
{
    private function makeItem(Tenant $tenant, array $extra = []): StockItem
    {
        return StockItem::create(array_merge([
            'tenant_id' => $tenant->id,
            'item_code' => 'SKU-'.uniqid(),
            'name' => 'Sync Widget',
            'unit' => 'ea',
            'current_balance' => 10,
            'status' => 'active',
        ], $extra));
    }

    public function test_sync_offline_applies_counts_by_barcode_and_client_key(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['barcode' => 'BC-SYNC-'.uniqid()]);

        $created = $http->postJson('/api/v1/stock/stocktakes', [
            'name' => 'Offline sync',
            'count_date' => now()->toDateString(),
            'stock_item_ids' => [$item->id],
        ])->assertCreated()->json('data');

        $id = (int) $created['id'];
        $key = 'offline-'.uniqid();

        $res = $http->postJson("/api/v1/stock/stocktakes/{$id}/sync-offline", [
            'lines' => [[
                'client_line_key' => $key,
                'barcode' => $item->barcode,
                'counted_qty' => 7,
            ]],
        ])->assertOk()->json('data');

        $this->assertCount(1, $res['applied']);
        $this->assertSame([], $res['conflicts']);
        $this->assertDatabaseHas('stocktake_lines', [
            'stocktake_id' => $id,
            'client_line_key' => $key,
            'counted_qty' => 7,
        ]);

        // Idempotent replay updates qty
        $http->postJson("/api/v1/stock/stocktakes/{$id}/sync-offline", [
            'lines' => [[
                'client_line_key' => $key,
                'barcode' => $item->barcode,
                'counted_qty' => 7,
            ]],
        ])->assertOk();

        $this->assertSame(1, StocktakeLine::where('stocktake_id', $id)->where('client_line_key', $key)->count());
    }

    public function test_sync_offline_reports_conflict_without_force(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['barcode' => 'BC-CF-'.uniqid()]);

        $created = $http->postJson('/api/v1/stock/stocktakes', [
            'name' => 'Conflict sync',
            'count_date' => now()->toDateString(),
            'stock_item_ids' => [$item->id],
        ])->assertCreated()->json('data');

        $id = (int) $created['id'];
        $lineId = (int) $created['lines'][0]['id'];
        $key = 'cf-'.uniqid();

        $http->putJson("/api/v1/stock/stocktakes/{$id}/counts", [
            'lines' => [['id' => $lineId, 'counted_qty' => 5, 'client_line_key' => $key]],
        ])->assertOk();

        $res = $http->postJson("/api/v1/stock/stocktakes/{$id}/sync-offline", [
            'force' => false,
            'lines' => [[
                'client_line_key' => $key,
                'counted_qty' => 9,
            ]],
        ])->assertOk()->json('data');

        $this->assertCount(1, $res['conflicts']);
        $this->assertSame(5, (int) StocktakeLine::find($lineId)->counted_qty);

        $http->postJson("/api/v1/stock/stocktakes/{$id}/sync-offline", [
            'force' => true,
            'lines' => [[
                'client_line_key' => $key,
                'counted_qty' => 9,
            ]],
        ])->assertOk();

        $this->assertSame(9, (int) StocktakeLine::find($lineId)->counted_qty);
    }

    public function test_sync_offline_rejects_completed_stocktake(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant);

        $created = $http->postJson('/api/v1/stock/stocktakes', [
            'name' => 'Closed sync',
            'count_date' => now()->toDateString(),
            'stock_item_ids' => [$item->id],
        ])->assertCreated()->json('data');

        $id = (int) $created['id'];
        $lineId = (int) $created['lines'][0]['id'];
        $http->putJson("/api/v1/stock/stocktakes/{$id}/counts", [
            'lines' => [['id' => $lineId, 'counted_qty' => 10]],
        ])->assertOk();
        $http->postJson("/api/v1/stock/stocktakes/{$id}/complete")->assertOk();

        $http->postJson("/api/v1/stock/stocktakes/{$id}/sync-offline", [
            'lines' => [['stock_item_id' => $item->id, 'counted_qty' => 1]],
        ])->assertStatus(422);
    }
}
