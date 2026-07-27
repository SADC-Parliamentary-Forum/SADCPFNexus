<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use Tests\TestCase;

class AssetCapitalisationTest extends TestCase
{
    private function makeCategory(Tenant $tenant, string $code = 'equipment'): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name'      => 'Equipment',
            'code'      => $code,
        ]);
    }

    private function makePendingAsset(Tenant $tenant, AssetCategory $category): Asset
    {
        return Asset::create([
            'tenant_id'  => $tenant->id,
            'asset_code' => 'AST-PEND-' . uniqid(),
            'name'       => 'Pending Laptop',
            'category'   => $category->code,
            'status'     => 'pending',
        ]);
    }

    public function test_admin_can_list_pending_assets_only(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);

        $pending = $this->makePendingAsset($tenant, $category);
        Asset::create([
            'tenant_id'  => $tenant->id,
            'asset_code' => 'AST-ACT-' . uniqid(),
            'name'       => 'Active Desk',
            'category'   => $category->code,
            'status'     => 'active',
        ]);

        $response = $http->getJson('/api/v1/assets?status=pending')->assertOk();
        $ids = collect($response->json('data'))->pluck('id');

        $this->assertTrue($ids->contains($pending->id));
        $this->assertCount(1, $ids);
    }

    public function test_admin_can_capitalise_pending_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$asset->id}/capitalise", [
            'purchase_date'        => '2026-01-15',
            'purchase_value'       => 12000,
            'useful_life_years'    => 3,
            'salvage_value'        => 0,
            'depreciation_method'  => 'straight_line',
            'category'             => $category->code,
        ])->assertOk()
          ->assertJsonPath('data.status', 'active')
          ->assertJsonPath('data.purchase_value', '12000.00');

        $this->assertDatabaseHas('assets', [
            'id'             => $asset->id,
            'status'         => 'active',
            'purchase_value' => 12000,
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'assets.capitalised',
        ]);
    }

    public function test_cannot_capitalise_non_pending_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = Asset::create([
            'tenant_id'  => $tenant->id,
            'asset_code' => 'AST-ACT-' . uniqid(),
            'name'       => 'Already Active',
            'category'   => $category->code,
            'status'     => 'active',
        ]);

        $http->postJson("/api/v1/assets/{$asset->id}/capitalise", [
            'purchase_date'  => '2026-01-15',
            'purchase_value' => 1000,
            'category'       => $category->code,
        ])->assertStatus(422);
    }

    public function test_staff_cannot_capitalise_pending_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$asset->id}/capitalise", [
            'purchase_date'  => '2026-01-15',
            'purchase_value' => 1000,
            'category'       => $category->code,
        ])->assertForbidden();
    }

    public function test_admin_can_reject_pending_capitalisation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$asset->id}/reject-capitalisation", [
            'reason' => 'Not a capital item — return to supplier',
        ])->assertOk()
          ->assertJsonPath('data.status', 'retired');

        $this->assertDatabaseHas('assets', [
            'id'     => $asset->id,
            'status' => 'retired',
        ]);

        $this->assertDatabaseHas('audit_logs', [
            'event' => 'assets.capitalisation_rejected',
        ]);
    }

    public function test_reject_requires_reason(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$asset->id}/reject-capitalisation", [])
            ->assertStatus(422);
    }
}
