<?php

namespace Tests\Feature\Stock;

use App\Models\StockCategory;
use App\Models\StockItem;
use App\Models\Tenant;
use Tests\TestCase;

class StockTest extends TestCase
{
    private function makeCategory(Tenant $tenant, array $overrides = []): StockCategory
    {
        return StockCategory::create(array_merge([
            'tenant_id' => $tenant->id,
            'name'      => 'Stationery',
            'code'      => 'sta-' . substr(uniqid(), -6),
        ], $overrides));
    }

    private function makeItem(Tenant $tenant, ?StockCategory $category = null, array $overrides = []): StockItem
    {
        return StockItem::create(array_merge([
            'tenant_id'         => $tenant->id,
            'stock_category_id' => $category?->id,
            'item_code'         => 'STK-' . substr(uniqid(), -8),
            'name'              => 'A4 Paper Ream',
            'unit'              => 'ream',
            'unit_cost'         => 5.50,
            'current_balance'   => 100,
            'reorder_level'     => 20,
        ], $overrides));
    }

    // ── Auth / access ─────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_stock_items(): void
    {
        $this->getJson('/api/v1/stock/items')->assertUnauthorized();
    }

    public function test_staff_can_list_stock_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/stock/items')->assertOk();
    }

    public function test_staff_cannot_create_stock_item(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $category = $this->makeCategory($tenant);

        $http->postJson('/api/v1/stock/items', [
            'item_code'         => 'STK-DENY-1',
            'name'              => 'Toner',
            'stock_category_id' => $category->id,
        ])->assertForbidden();
    }

    // ── Category CRUD ─────────────────────────────────────────────────────────

    public function test_admin_can_create_stock_category(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->postJson('/api/v1/stock/categories', [
            'name' => 'Toner & Cartridges',
            'code' => 'toner',
        ])->assertCreated()->assertJsonPath('data.code', 'toner');

        $this->assertDatabaseHas('stock_categories', [
            'tenant_id' => $tenant->id,
            'code'      => 'toner',
        ]);
    }

    public function test_admin_can_update_stock_category(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);

        $http->putJson("/api/v1/stock/categories/{$category->id}", [
            'name' => 'Renamed Category',
        ])->assertOk()->assertJsonPath('data.name', 'Renamed Category');
    }

    public function test_cannot_delete_category_in_use(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeItem($tenant, $category);

        $http->deleteJson("/api/v1/stock/categories/{$category->id}")->assertStatus(422);
        $this->assertDatabaseHas('stock_categories', ['id' => $category->id]);
    }

    public function test_can_delete_unused_category(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);

        $http->deleteJson("/api/v1/stock/categories/{$category->id}")->assertOk();
        $this->assertDatabaseMissing('stock_categories', ['id' => $category->id]);
    }

    // ── Item CRUD ─────────────────────────────────────────────────────────────

    public function test_admin_can_create_stock_item(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);

        $http->postJson('/api/v1/stock/items', [
            'item_code'         => 'STK-CREATE-1',
            'name'              => 'Blue Pens (box)',
            'stock_category_id' => $category->id,
            'unit'              => 'box',
            'unit_cost'         => 12.0,
            'reorder_level'     => 5,
        ])->assertCreated()->assertJsonPath('data.current_balance', 0);

        $this->assertDatabaseHas('stock_items', [
            'tenant_id' => $tenant->id,
            'item_code' => 'STK-CREATE-1',
        ]);
    }

    public function test_creating_item_with_opening_balance_records_stock_in(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);

        $res = $http->postJson('/api/v1/stock/items', [
            'item_code'         => 'STK-OPEN-1',
            'name'              => 'Name Tags',
            'stock_category_id' => $category->id,
            'opening_balance'   => 40,
            'reorder_level'     => 10,
        ])->assertCreated();

        $itemId = $res->json('data.id');
        $this->assertSame(40, (int) $res->json('data.current_balance'));
        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id' => $itemId,
            'type'          => 'in',
            'quantity'      => 40,
            'balance_after' => 40,
        ]);
    }

    public function test_item_update_cannot_change_balance_directly(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant);

        $http->putJson("/api/v1/stock/items/{$item->id}", [
            'name'            => 'Updated Name',
            'current_balance' => 9999,
        ])->assertOk();

        $this->assertDatabaseHas('stock_items', [
            'id'              => $item->id,
            'name'            => 'Updated Name',
            'current_balance' => 100, // unchanged
        ]);
    }

    public function test_cannot_view_other_tenants_item(): void
    {
        $tenant = Tenant::factory()->create();
        $other  = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($other);

        $http->getJson("/api/v1/stock/items/{$item->id}")->assertNotFound();
    }

    // ── Movements: balance updates ────────────────────────────────────────────

    public function test_stock_in_increases_balance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, null, ['current_balance' => 100]);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'in',
            'quantity'         => 25,
            'transaction_date' => now()->toDateString(),
            'reference'        => 'GRN-001',
        ])->assertCreated()->assertJsonPath('data.balance_after', 125);

        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 125]);
    }

    public function test_stock_out_decreases_balance_and_records_issued_to(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $recipient = $this->makeUser('staff', $tenant);
        $item = $this->makeItem($tenant, null, ['current_balance' => 100]);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'     => $item->id,
            'type'              => 'out',
            'quantity'          => 30,
            'issued_to_user_id' => $recipient->id,
            'transaction_date'  => now()->toDateString(),
        ])->assertCreated()->assertJsonPath('data.balance_after', 70);

        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 70]);
        $this->assertDatabaseHas('stock_transactions', [
            'stock_item_id'     => $item->id,
            'type'              => 'out',
            'quantity'          => -30,
            'issued_to_user_id' => $recipient->id,
        ]);
    }

    public function test_stock_out_cannot_drive_balance_negative(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, null, ['current_balance' => 10]);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'out',
            'quantity'         => 50,
            'transaction_date' => now()->toDateString(),
        ])->assertStatus(422);

        // Balance unchanged and no movement persisted
        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 10]);
        $this->assertDatabaseMissing('stock_transactions', ['stock_item_id' => $item->id]);
    }

    public function test_adjustment_can_correct_balance_down(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, null, ['current_balance' => 100]);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'adjustment',
            'quantity'         => -15,
            'reason'           => 'Stock count correction',
            'transaction_date' => now()->toDateString(),
        ])->assertCreated()->assertJsonPath('data.balance_after', 85);

        $this->assertDatabaseHas('stock_items', ['id' => $item->id, 'current_balance' => 85]);
    }

    public function test_staff_cannot_record_movement(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $item = $this->makeItem($tenant);

        $http->postJson('/api/v1/stock/transactions', [
            'stock_item_id'    => $item->id,
            'type'             => 'in',
            'quantity'         => 5,
            'transaction_date' => now()->toDateString(),
        ])->assertForbidden();
    }

    // ── Low-stock detection ───────────────────────────────────────────────────

    public function test_low_stock_filter_returns_items_at_or_below_reorder(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $low  = $this->makeItem($tenant, null, ['current_balance' => 5,  'reorder_level' => 20, 'name' => 'Low Item']);
        $okay = $this->makeItem($tenant, null, ['current_balance' => 80, 'reorder_level' => 20, 'name' => 'Healthy Item']);

        $res = $http->getJson('/api/v1/stock/items?low_stock=1')->assertOk();
        $ids = collect($res->json('data'))->pluck('id')->all();

        $this->assertContains($low->id, $ids);
        $this->assertNotContains($okay->id, $ids);
    }

    public function test_item_exposes_is_low_stock_flag(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $item = $this->makeItem($tenant, null, ['current_balance' => 5, 'reorder_level' => 20]);

        $http->getJson("/api/v1/stock/items/{$item->id}")
            ->assertOk()
            ->assertJsonPath('data.is_low_stock', true);
    }

    // ── Reports / export ──────────────────────────────────────────────────────

    public function test_stock_report_json_shape(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeItem($tenant, $category);

        $http->getJson('/api/v1/reports/stock')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [['id', 'item_code', 'name', 'current_balance', 'reorder_level', 'is_low_stock', 'stock_value']],
            ]);
    }

    public function test_stock_report_csv_export(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeItem($tenant, $category, ['name' => 'CSV Paper', 'item_code' => 'STK-CSV-1']);

        $res = $http->get('/api/v1/reports/stock?format=csv');
        $res->assertOk();
        $res->assertHeader('content-type', 'text/csv; charset=UTF-8');

        $content = $res->streamedContent();
        $this->assertStringContainsString('item_code', $content);
        $this->assertStringContainsString('STK-CSV-1', $content);
        $this->assertStringContainsString('current_balance', $content);
    }
}
