<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetRevaluation;
use App\Models\Tenant;
use Tests\TestCase;

class AssetRevaluationTest extends TestCase
{
    private function makeCategory(Tenant $tenant): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Equipment',
            'code' => 'eq-'.uniqid(),
        ]);
    }

    private function makeActiveAsset(Tenant $tenant, AssetCategory $category, array $extra = []): Asset
    {
        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-'.uniqid(),
            'name' => 'Reval Device',
            'category' => $category->code,
            'status' => 'active',
            'asset_class' => 'capital',
            'purchase_value' => 10000,
            'book_value' => 8000,
            'accumulated_depreciation' => 2000,
        ], $extra));
    }

    public function test_revaluation_request_list_and_approve_updates_book_value(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makeActiveAsset($tenant, $category);

        $create = $http->postJson('/api/v1/asset-revaluations', [
            'asset_id' => $asset->id,
            'proposed_value' => 6500,
            'reason' => 'Market adjustment after impairment review',
            'effective_date' => '2026-07-29',
        ])->assertCreated()
            ->assertJsonPath('data.status', 'pending');

        $id = (int) $create->json('data.id');

        $http->getJson('/api/v1/asset-revaluations')
            ->assertOk()
            ->assertJsonFragment(['id' => $id]);

        $http->postJson("/api/v1/asset-revaluations/{$id}/approve", [
            'comments' => 'Finance concurs',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $this->assertDatabaseHas('assets', [
            'id' => $asset->id,
            'book_value' => 6500,
        ]);

        $this->assertDatabaseHas('asset_revaluations', [
            'id' => $id,
            'status' => 'approved',
            'previous_book_value' => 8000,
            'proposed_value' => 6500,
        ]);
    }

    public function test_cannot_approve_non_pending_revaluation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makeActiveAsset($tenant, $category);

        $reval = AssetRevaluation::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $asset->id,
            'reference' => 'REVAL-TEST1',
            'status' => 'approved',
            'previous_book_value' => 8000,
            'proposed_value' => 7000,
            'reason' => 'Already done',
            'effective_date' => now()->toDateString(),
            'requested_by' => $user->id,
        ]);

        $http->postJson("/api/v1/asset-revaluations/{$reval->id}/approve")
            ->assertStatus(422);
    }

    public function test_staff_cannot_request_revaluation(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makeActiveAsset($tenant, $category);

        $http->postJson('/api/v1/asset-revaluations', [
            'asset_id' => $asset->id,
            'proposed_value' => 5000,
            'reason' => 'Should fail',
            'effective_date' => '2026-07-29',
        ])->assertForbidden();
    }
}
