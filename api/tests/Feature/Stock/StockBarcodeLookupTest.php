<?php

namespace Tests\Feature\Stock;

use App\Models\StockItem;
use App\Models\Stocktake;
use App\Models\StocktakeLine;
use App\Models\Tenant;
use Tests\TestCase;

class StockBarcodeLookupTest extends TestCase
{
    private function makeItem(Tenant $tenant, array $extra = []): StockItem
    {
        return StockItem::create(array_merge([
            'tenant_id' => $tenant->id,
            'item_code' => 'SKU-'.uniqid(),
            'name' => 'Barcode Widget',
            'unit' => 'ea',
            'current_balance' => 10,
            'status' => 'active',
        ], $extra));
    }

    public function test_lookup_item_by_barcode(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['barcode' => 'BC-'.uniqid()]);

        $http->getJson('/api/v1/stock/items/by-barcode/'.$item->barcode)
            ->assertOk()
            ->assertJsonPath('data.id', $item->id)
            ->assertJsonPath('data.barcode', $item->barcode);
    }

    public function test_unknown_barcode_returns_404(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/stock/items/by-barcode/DOES-NOT-EXIST')
            ->assertNotFound();
    }

    public function test_stocktake_count_accepts_client_line_key_for_offline_queue(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['barcode' => 'BC-OFF-'.uniqid()]);

        $created = $http->postJson('/api/v1/stock/stocktakes', [
            'name' => 'Offline draft',
            'count_date' => now()->toDateString(),
            'stock_item_ids' => [$item->id],
        ])->assertCreated()->json('data');

        $stocktakeId = (int) $created['id'];
        $lineId = (int) ($created['lines'][0]['id'] ?? 0);
        $this->assertGreaterThan(0, $lineId);

        $key = 'offline-'.uniqid();

        $http->putJson("/api/v1/stock/stocktakes/{$stocktakeId}/counts", [
            'lines' => [[
                'id' => $lineId,
                'counted_qty' => 8,
                'client_line_key' => $key,
            ]],
        ])->assertOk();

        $this->assertDatabaseHas('stocktake_lines', [
            'id' => $lineId,
            'client_line_key' => $key,
            'counted_qty' => 8,
        ]);

        // Replay same offline key with a corrected count — still one line.
        $http->putJson("/api/v1/stock/stocktakes/{$stocktakeId}/counts", [
            'lines' => [[
                'id' => $lineId,
                'counted_qty' => 9,
                'client_line_key' => $key,
            ]],
        ])->assertOk();

        $this->assertSame(1, StocktakeLine::where('stocktake_id', $stocktakeId)->where('client_line_key', $key)->count());
        $this->assertSame(9, (int) StocktakeLine::find($lineId)->counted_qty);
        $this->assertSame(Stocktake::STATUS_IN_PROGRESS, Stocktake::find($stocktakeId)->status);
    }
}
