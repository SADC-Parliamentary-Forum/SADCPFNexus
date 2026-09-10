<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use Tests\TestCase;

class AssetRegisterListTest extends TestCase
{
    private function makeCategory(Tenant $tenant, string $code = 'equipment'): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Equipment',
            'code' => $code.'-'.uniqid(),
        ]);
    }

    /**
     * @param  array<string, mixed>  $extra
     */
    private function makeAsset(Tenant $tenant, AssetCategory $category, array $extra = []): Asset
    {
        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-'.uniqid(),
            'name' => 'Test Device',
            'category' => $category->code,
            'status' => 'active',
        ], $extra));
    }

    public function test_list_returns_one_page_and_unfiltered_status_summary(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeAsset($tenant, $category, ['asset_code' => 'PAGE-A', 'name' => 'Alpha', 'status' => 'active']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'PAGE-B', 'name' => 'Bravo', 'status' => 'pending']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'PAGE-C', 'name' => 'Charlie', 'status' => 'retired']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'PAGE-D', 'name' => 'Delta', 'status' => 'disposed']);

        $page1 = $http->getJson('/api/v1/assets?status=live&per_page=1&page=1')->assertOk();

        $this->assertCount(1, $page1->json('data'));
        $this->assertSame('PAGE-A', $page1->json('data.0.asset_code'));
        $this->assertSame(2, $page1->json('total'));
        $this->assertSame(2, $page1->json('last_page'));
        $this->assertSame(2, $page1->json('summary.live'));
        $this->assertSame(1, $page1->json('summary.pending'));
        $this->assertSame(1, $page1->json('summary.active'));
        $this->assertSame(1, $page1->json('summary.retired'));
        $this->assertSame(1, $page1->json('summary.disposed'));
        $this->assertSame(4, $page1->json('summary.total'));
        $this->assertContains($category->code, $page1->json('summary.categories'));

        $page2 = $http->getJson('/api/v1/assets?status=live&per_page=1&page=2')->assertOk();
        $this->assertSame('PAGE-B', $page2->json('data.0.asset_code'));
        $this->assertSame(2, $page2->json('summary.live'));
    }

    public function test_dashboard_includes_live_retired_and_disposed_counts(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeAsset($tenant, $category, ['asset_code' => 'DASH-A', 'status' => 'active']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'DASH-P', 'status' => 'pending']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'DASH-R', 'status' => 'retired']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'DASH-D', 'status' => 'disposed']);

        $http->getJson('/api/v1/assets/dashboard')
            ->assertOk()
            ->assertJsonPath('data.live', 2)
            ->assertJsonPath('data.pending', 1)
            ->assertJsonPath('data.active', 1)
            ->assertJsonPath('data.retired', 1)
            ->assertJsonPath('data.disposed', 1)
            ->assertJsonPath('data.total', 4);
    }

    public function test_search_does_not_shrink_register_summary_counts(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeAsset($tenant, $category, ['asset_code' => 'KEEP-1', 'name' => 'Keep Laptop', 'status' => 'active']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'SKIP-1', 'name' => 'Other Chair', 'status' => 'active']);

        $res = $http->getJson('/api/v1/assets?search=Keep&per_page=25')->assertOk();

        $this->assertCount(1, $res->json('data'));
        $this->assertSame(1, $res->json('total'));
        $this->assertSame(2, $res->json('summary.live'));
        $this->assertSame(2, $res->json('summary.active'));
    }
}
