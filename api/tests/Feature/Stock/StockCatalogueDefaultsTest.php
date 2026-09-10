<?php

namespace Tests\Feature\Stock;

use App\Models\StockCategory;
use App\Models\StockUnit;
use App\Models\Tenant;
use Tests\TestCase;

class StockCatalogueDefaultsTest extends TestCase
{
    public function test_listing_units_seeds_default_units_of_measure(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->getJson('/api/v1/stock/units')->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();

        foreach (['each', 'box', 'pack', 'ream'] as $code) {
            $this->assertContains($code, $codes);
        }

        $this->assertDatabaseHas('stock_units', [
            'tenant_id' => $tenant->id,
            'code'      => 'ream',
        ]);
    }

    public function test_listing_categories_seeds_default_stock_categories(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->getJson('/api/v1/stock/categories')->assertOk();
        $codes = collect($res->json('data'))->pluck('code')->all();

        foreach (['stationery', 'toner', 'it_consumables'] as $code) {
            $this->assertContains($code, $codes);
        }
    }

    public function test_item_can_be_created_and_updated_with_category_and_unit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $category = StockCategory::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Stationery',
            'code'      => 'sta-cat-'.substr(uniqid(), -6),
        ]);
        $unit = StockUnit::create([
            'tenant_id' => $tenant->id,
            'code'      => 'u-'.substr(uniqid(), -6),
            'name'      => 'Ream',
        ]);
        $otherCategory = StockCategory::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Toner',
            'code'      => 'ton-cat-'.substr(uniqid(), -6),
        ]);
        $otherUnit = StockUnit::create([
            'tenant_id' => $tenant->id,
            'code'      => 'u2-'.substr(uniqid(), -6),
            'name'      => 'Box',
        ]);

        $created = $http->postJson('/api/v1/stock/items', [
            'item_code'         => 'STK-CAT-UOM-1',
            'name'              => 'A4 Paper',
            'stock_category_id' => $category->id,
            'stock_unit_id'     => $unit->id,
        ])->assertCreated();

        $this->assertSame($category->id, (int) $created->json('data.stock_category_id'));
        $this->assertSame($unit->id, (int) $created->json('data.stock_unit_id'));
        $this->assertSame('Stationery', $created->json('data.category.name'));
        $this->assertSame($unit->code, $created->json('data.unit_of_measure.code'));

        $itemId = (int) $created->json('data.id');

        $updated = $http->putJson("/api/v1/stock/items/{$itemId}", [
            'stock_category_id' => $otherCategory->id,
            'stock_unit_id'     => $otherUnit->id,
        ])->assertOk();

        $this->assertSame($otherCategory->id, (int) $updated->json('data.stock_category_id'));
        $this->assertSame($otherUnit->id, (int) $updated->json('data.stock_unit_id'));
        $this->assertDatabaseHas('stock_items', [
            'id'                => $itemId,
            'stock_category_id' => $otherCategory->id,
            'stock_unit_id'     => $otherUnit->id,
        ]);
    }

    public function test_seeding_defaults_is_idempotent(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/stock/units')->assertOk();
        $first = StockUnit::where('tenant_id', $tenant->id)->count();
        $http->getJson('/api/v1/stock/units')->assertOk();
        $this->assertSame($first, StockUnit::where('tenant_id', $tenant->id)->count());

        $http->getJson('/api/v1/stock/categories')->assertOk();
        $catFirst = StockCategory::where('tenant_id', $tenant->id)->count();
        $http->getJson('/api/v1/stock/categories')->assertOk();
        $this->assertSame($catFirst, StockCategory::where('tenant_id', $tenant->id)->count());
    }
}
