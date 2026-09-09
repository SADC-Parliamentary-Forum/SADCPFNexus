<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use Tests\TestCase;

class AssetQrBatchTest extends TestCase
{
    private function makeCategory(Tenant $tenant): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Equipment',
            'code' => 'EQ-'.uniqid(),
        ]);
    }

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

    public function test_unauthenticated_cannot_batch_qr(): void
    {
        $this->postJson('/api/v1/assets/qr-batch', ['ids' => [1]])->assertUnauthorized();
    }

    public function test_staff_without_assets_view_cannot_batch_qr(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->postJson('/api/v1/assets/qr-batch', ['ids' => [1]])->assertForbidden();
    }

    public function test_assets_view_can_batch_qr_for_own_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->givePermissionTo('assets.view');
        $http = $this->asUser($user);

        $category = $this->makeCategory($tenant);
        $keep = $this->makeAsset($tenant, $category, ['asset_code' => 'KEEP-QR']);
        $foreign = $this->makeAsset($other, $this->makeCategory($other), ['asset_code' => 'SKIP-QR']);

        $payload = $http->postJson('/api/v1/assets/qr-batch', ['ids' => [$keep->id, $foreign->id]])
            ->assertOk()
            ->assertJsonCount(1, 'data')
            ->json('data');

        $this->assertSame($keep->id, $payload[0]['id']);
        $this->assertStringStartsWith('data:image/', $payload[0]['image']);
        $this->assertStringContainsString(';base64,', $payload[0]['image']);

        $keep->refresh();
        $this->assertNotEmpty($keep->qr_token);
        $this->assertNotEmpty($keep->qr_path);
    }

    public function test_empty_ids_returns_empty_data(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->postJson('/api/v1/assets/qr-batch', ['ids' => []])
            ->assertOk()
            ->assertExactJson(['data' => []]);
    }

    public function test_more_than_500_ids_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $ids = range(1, 501);

        $http->postJson('/api/v1/assets/qr-batch', ['ids' => $ids])
            ->assertUnprocessable();
    }

    public function test_invalid_ids_are_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->postJson('/api/v1/assets/qr-batch', ['ids' => ['x', 0]])
            ->assertUnprocessable();
    }
}
