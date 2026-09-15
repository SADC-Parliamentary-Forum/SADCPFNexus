<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCategory;
use App\Models\AssetLocation;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ClearAssetRegisterCommandTest extends TestCase
{
    public function test_clear_register_removes_assets_and_keeps_catalogue(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT-'.uniqid(),
            'useful_life_years' => 3,
        ]);
        $location = null;
        if (Schema::hasTable('asset_locations')) {
            $location = AssetLocation::create([
                'tenant_id' => $tenant->id,
                'name' => 'Main Store',
                'code' => 'STORE-'.uniqid(),
                'location_type' => 'warehouse',
            ]);
        }
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'DEMO-'.$tenant->id,
            'tag_number' => 'PF/ICT/LT/001-'.$tenant->id,
            'name' => 'Demo laptop',
            'category' => $category->code,
            'status' => 'available',
            'location_id' => $location?->id,
        ]);
        AssetAssignmentHistory::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $asset->id,
            'assignment_type' => 'custody',
            'assigned_at' => now(),
        ]);
        Asset::create([
            'tenant_id' => $other->id,
            'asset_code' => 'KEEP-'.$other->id,
            'tag_number' => 'PF/ICT/LT/999-'.$other->id,
            'name' => 'Other tenant laptop',
            'category' => 'ICT',
            'status' => 'available',
        ]);
        if (Schema::hasTable('asset_number_sequences')) {
            DB::table('asset_number_sequences')->insert([
                'tenant_id' => $tenant->id,
                'category_code' => $category->code,
                'subcategory_code' => 'LT',
                'next_number' => 42,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }

        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());

        $exit = Artisan::call('assets:clear-register', ['--force' => true, '--tenant' => $tenant->id]);
        $this->assertSame(0, $exit);
        $this->assertSame(0, Asset::query()->where('tenant_id', $tenant->id)->count());
        $this->assertSame(1, Asset::query()->where('tenant_id', $other->id)->count());
        $this->assertSame(0, AssetAssignmentHistory::query()->where('tenant_id', $tenant->id)->count());
        $this->assertTrue($category->fresh()->exists);
        if ($location) {
            $this->assertTrue($location->fresh()->exists);
        }
        if (Schema::hasTable('asset_number_sequences')) {
            $this->assertSame(1, (int) DB::table('asset_number_sequences')
                ->where('tenant_id', $tenant->id)
                ->where('category_code', $category->code)
                ->value('next_number'));
        }
    }

    public function test_clear_register_requires_force_flag(): void
    {
        $this->assertNotSame(0, Artisan::call('assets:clear-register'));
        $this->assertStringContainsString('--force', Artisan::output());
    }
}
