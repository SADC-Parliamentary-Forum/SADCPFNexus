<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetRequest;
use App\Models\Tenant;
use Tests\TestCase;

class AssetsTest extends TestCase
{
    private function makeCategory(Tenant $tenant): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name'      => 'IT Equipment',
            'code'      => 'IT-' . uniqid(),
        ]);
    }

    private function makeAsset(Tenant $tenant, AssetCategory $category): Asset
    {
        return Asset::create([
            'tenant_id'  => $tenant->id,
            'asset_code' => 'AST-' . uniqid(),
            'name'       => 'Test Laptop',
            'category'   => $category->code,
            'status'     => 'active',
        ]);
    }

    // ─── Asset Categories ────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_assets(): void
    {
        $this->getJson('/api/v1/assets')->assertUnauthorized();
    }

    public function test_staff_can_list_assets(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/assets')->assertOk();
    }

    public function test_admin_can_create_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);

        $response = $http->postJson('/api/v1/assets', [
            'asset_code' => 'AST-TEST-001',
            'name'       => 'HP Laptop',
            'category'   => $category->code,
            'status'     => 'active',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('assets', [
            'asset_code' => 'AST-TEST-001',
            'tenant_id'  => $tenant->id,
        ]);
    }

    public function test_staff_cannot_create_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $category = $this->makeCategory($tenant);

        $http->postJson('/api/v1/assets', [
            'asset_code' => 'AST-STAFF-001',
            'name'       => 'HP Laptop',
            'category'   => $category->code,
        ])->assertForbidden();
    }

    public function test_admin_can_retire_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makeAsset($tenant, $category);

        $http->deleteJson("/api/v1/assets/{$asset->id}")
             ->assertOk()
             ->assertJsonPath('message', 'Asset retired.');

        $this->assertDatabaseHas('assets', [
            'id'     => $asset->id,
            'status' => 'retired',
        ]);
    }

    // ─── Asset Requests ──────────────────────────────────────────────────────

    public function test_staff_can_submit_asset_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $response = $http->postJson('/api/v1/asset-requests', [
            'justification' => 'I need a laptop for remote work.',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('asset_requests', [
            'requester_id' => $user->id,
            'status'       => 'pending',
        ]);
    }

    public function test_staff_can_view_own_asset_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $req = AssetRequest::create([
            'tenant_id'     => $tenant->id,
            'requester_id'  => $user->id,
            'justification' => 'Need equipment',
            'status'        => 'pending',
        ]);

        $http->getJson("/api/v1/asset-requests/{$req->id}")->assertOk();
    }

    public function test_staff_cannot_view_another_users_asset_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $other = $this->makeUser('staff', $tenant);

        $req = AssetRequest::create([
            'tenant_id'     => $tenant->id,
            'requester_id'  => $other->id,
            'justification' => 'Not yours',
            'status'        => 'pending',
        ]);

        $http->getJson("/api/v1/asset-requests/{$req->id}")->assertForbidden();
    }

    public function test_staff_can_update_own_pending_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $req = AssetRequest::create([
            'tenant_id'     => $tenant->id,
            'requester_id'  => $user->id,
            'justification' => 'Original reason',
            'status'        => 'pending',
        ]);

        $http->putJson("/api/v1/asset-requests/{$req->id}", [
            'justification' => 'Updated reason',
        ])->assertOk();

        $this->assertDatabaseHas('asset_requests', [
            'id'            => $req->id,
            'justification' => 'Updated reason',
        ]);
    }

    public function test_staff_cannot_update_approved_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $req = AssetRequest::create([
            'tenant_id'     => $tenant->id,
            'requester_id'  => $user->id,
            'justification' => 'Done',
            'status'        => 'approved',
        ]);

        $http->putJson("/api/v1/asset-requests/{$req->id}", [
            'justification' => 'Changed',
        ])->assertUnprocessable();
    }

    public function test_staff_can_cancel_own_pending_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $req = AssetRequest::create([
            'tenant_id'     => $tenant->id,
            'requester_id'  => $user->id,
            'justification' => 'Cancel me',
            'status'        => 'pending',
        ]);

        $http->deleteJson("/api/v1/asset-requests/{$req->id}")->assertOk();
        $this->assertDatabaseMissing('asset_requests', ['id' => $req->id]);
    }

    public function test_admin_can_approve_asset_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $req = AssetRequest::create([
            'tenant_id'     => $tenant->id,
            'requester_id'  => $staff->id,
            'justification' => 'Needs approval',
            'status'        => 'pending',
        ]);

        $http->putJson("/api/v1/asset-requests/{$req->id}", [
            'status' => 'approved',
        ])->assertOk();

        $this->assertDatabaseHas('asset_requests', [
            'id'     => $req->id,
            'status' => 'approved',
        ]);
    }
}
