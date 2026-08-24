<?php

namespace Tests\Feature\Stock;

use App\Models\StockItem;
use App\Models\StockRequest;
use App\Models\Tenant;
use Tests\TestCase;

class StockEventPackBarcodeTest extends TestCase
{
    private function makeItem(Tenant $tenant, array $extra = []): StockItem
    {
        return StockItem::create(array_merge([
            'tenant_id' => $tenant->id,
            'item_code' => 'SKU-'.uniqid(),
            'name' => 'Event badge',
            'unit' => 'ea',
            'current_balance' => 40,
            'status' => 'active',
        ], $extra));
    }

    public function test_event_pack_instantiates_draft_request_without_issuing(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $pens = $this->makeItem($tenant, ['name' => 'Pens', 'barcode' => 'BC-PENS-'.uniqid()]);
        $folders = $this->makeItem($tenant, ['name' => 'Folders', 'barcode' => 'BC-FOLD-'.uniqid()]);

        $created = $http->postJson('/api/v1/stock/event-packs', [
            'name' => 'Plenary welcome pack',
            'event_type' => 'plenary',
            'lines' => [
                ['stock_item_id' => $pens->id, 'quantity' => 20],
                ['stock_item_id' => $folders->id, 'quantity' => 10],
            ],
        ])->assertCreated()->json('data');

        $this->assertCount(2, $created['lines']);

        $inst = $http->postJson('/api/v1/stock/event-packs/'.$created['id'].'/instantiate', [
            'purpose' => 'August plenary',
        ])->assertCreated()->json('data');

        $this->assertSame(StockRequest::STATUS_DRAFT, $inst['status']);
        $this->assertNotSame(StockRequest::STATUS_ISSUED, $inst['status']);
        $this->assertCount(2, $inst['lines']);
    }

    public function test_event_pack_duplicate_copies_lines_without_issuing(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $pens = $this->makeItem($tenant, ['name' => 'Pens']);

        $created = $http->postJson('/api/v1/stock/event-packs', [
            'name' => 'Plenary welcome pack',
            'event_type' => 'plenary',
            'lines' => [
                ['stock_item_id' => $pens->id, 'quantity' => 20],
            ],
        ])->assertCreated()->json('data');

        $copy = $http->postJson('/api/v1/stock/event-packs/'.$created['id'].'/duplicate')
            ->assertCreated()
            ->json('data');

        $this->assertNotSame($created['id'], $copy['id']);
        $this->assertCount(1, $copy['lines']);
        $this->assertStringContainsString('(copy)', (string) $copy['name']);
        $this->assertSame(0, StockRequest::where('tenant_id', $tenant->id)->count());
    }

    public function test_bulk_barcode_lookup_returns_matches_and_misses(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, ['barcode' => 'BC-BULK-'.uniqid()]);

        $http->postJson('/api/v1/stock/items/barcode-lookup', [
            'barcodes' => [$item->barcode, 'MISSING-CODE'],
        ])->assertOk()
            ->assertJsonPath('data.matched.0.id', $item->id)
            ->assertJsonPath('data.missing.0', 'MISSING-CODE');
    }
}
