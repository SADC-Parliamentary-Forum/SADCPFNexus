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

    public function test_admin_api_clears_own_tenant_register_and_keeps_catalogue(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT-API-'.uniqid(),
            'useful_life_years' => 3,
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'WIPE-'.$tenant->id,
            'tag_number' => 'PF/ICT/LT/010-'.$tenant->id,
            'name' => 'Laptop to replace',
            'category' => $category->code,
            'status' => 'available',
        ]);
        Asset::create([
            'tenant_id' => $other->id,
            'asset_code' => 'KEEP-API-'.$other->id,
            'name' => 'Other tenant laptop',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $res = $http->postJson('/api/v1/assets/register/clear', [
            'confirmation' => 'CLEAR REGISTER',
        ]);
        $res->assertOk()
            ->assertJsonPath('data.deleted_count', 1)
            ->assertJsonPath('data.remaining_count', 0);

        $this->assertSame(0, Asset::query()->where('tenant_id', $tenant->id)->count());
        $this->assertSame(1, Asset::query()->where('tenant_id', $other->id)->count());
        $this->assertTrue($category->fresh()->exists);
        $this->assertDatabaseHas('audit_logs', [
            'event' => 'assets.register_cleared',
            'tenant_id' => $tenant->id,
        ]);
    }

    public function test_clear_register_api_rejects_wrong_confirmation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KEEP-PHRASE-'.$tenant->id,
            'name' => 'Must remain',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $http->postJson('/api/v1/assets/register/clear', [
            'confirmation' => 'delete all',
        ])->assertStatus(422);

        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());
    }

    public function test_guest_and_staff_cannot_clear_register_via_api(): void
    {
        $tenant = Tenant::factory()->create();
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KEEP-AUTH-'.$tenant->id,
            'name' => 'Must remain',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $this->postJson('/api/v1/assets/register/clear', [
            'confirmation' => 'CLEAR REGISTER',
        ])->assertUnauthorized();

        [$staffHttp] = $this->asStaff($tenant);
        $staffHttp->postJson('/api/v1/assets/register/clear', [
            'confirmation' => 'CLEAR REGISTER',
        ])->assertForbidden();

        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());
    }

    public function test_assets_manage_without_admin_cannot_clear_register_via_api(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->givePermissionTo(['assets.view', 'assets.manage']);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KEEP-MANAGE-'.$tenant->id,
            'name' => 'Must remain',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $this->asUser($user)->postJson('/api/v1/assets/register/clear', [
            'confirmation' => 'CLEAR REGISTER',
        ])->assertForbidden();

        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());
    }

    public function test_clear_register_requires_force_flag(): void
    {
        $this->assertNotSame(0, Artisan::call('assets:clear-register'));
        $this->assertStringContainsString('--force', Artisan::output());
    }

    public function test_invalid_tenant_option_does_not_wipe_any_register(): void
    {
        $tenant = Tenant::factory()->create();
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KEEP-INVALID-'.$tenant->id,
            'name' => 'Must remain',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        foreach ([0, '0', 'abc'] as $tenantOption) {
            $exit = Artisan::call('assets:clear-register', [
                '--force' => true,
                '--tenant' => $tenantOption,
            ]);
            $this->assertNotSame(0, $exit, 'Expected failure for --tenant='.var_export($tenantOption, true));
            $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());
        }
    }

    public function test_unknown_tenant_id_does_not_wipe_any_register(): void
    {
        $tenant = Tenant::factory()->create();
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'KEEP-UNKNOWN-'.$tenant->id,
            'name' => 'Must remain',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $missingId = $tenant->id + 99999;
        $exit = Artisan::call('assets:clear-register', [
            '--force' => true,
            '--tenant' => $missingId,
        ]);
        $this->assertNotSame(0, $exit);
        $this->assertSame(1, Asset::query()->where('tenant_id', $tenant->id)->count());
    }
}
