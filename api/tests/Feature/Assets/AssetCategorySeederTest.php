<?php

namespace Tests\Feature\Assets;

use App\Models\AssetCategory;
use App\Models\Tenant;
use Database\Seeders\AssetCategorySeeder;
use Tests\TestCase;

class AssetCategorySeederTest extends TestCase
{
    public function test_seeds_official_far_categories_for_every_tenant(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'not-sadcpf']);

        $this->seed(AssetCategorySeeder::class);

        $expected = [
            'furniture' => 'Office Furniture',
            'it' => 'IT Equipment',
            'equipment' => 'Office Equipment',
            'kitchen' => 'Kitchen Equipment',
            'fleet' => 'Vehicles',
            'security' => 'Security Equipment',
            'specialized' => 'Specialized Equipment',
            'av' => 'Audio Visual Equipment',
            'sports' => 'Other (Sports Equipment)',
            'conference' => 'Other (Conference Equipment)',
        ];

        foreach ($expected as $code => $name) {
            $this->assertDatabaseHas('asset_categories', [
                'tenant_id' => $tenant->id,
                'code' => $code,
                'name' => $name,
            ]);
        }

        $this->assertSame(10, AssetCategory::query()->where('tenant_id', $tenant->id)->whereIn('code', array_keys($expected))->count());
    }

    public function test_reseed_updates_legacy_display_names_without_duplicating(): void
    {
        $tenant = Tenant::factory()->create(['slug' => 'sadcpf']);
        AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'IT',
            'code' => 'it',
            'sort_order' => 10,
        ]);

        $this->seed(AssetCategorySeeder::class);
        $this->seed(AssetCategorySeeder::class);

        $this->assertSame(1, AssetCategory::query()->where('tenant_id', $tenant->id)->where('code', 'it')->count());
        $this->assertSame('IT Equipment', AssetCategory::query()->where('tenant_id', $tenant->id)->where('code', 'it')->value('name'));
    }
}
