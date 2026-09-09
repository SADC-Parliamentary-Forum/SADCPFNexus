<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCategory;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AssetCustodyHandshakeTest extends TestCase
{
    private function makeCategory(Tenant $tenant): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Equipment',
            'code' => 'eq-'.uniqid(),
        ]);
    }

    private function makeAsset(Tenant $tenant, AssetCategory $category): Asset
    {
        return Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-'.uniqid(),
            'name' => 'Laptop PF/ICT/142',
            'category' => $category->code,
            'status' => 'active',
        ]);
    }

    public function test_assign_notifies_recipient_and_waits_for_acceptance(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $asset = $this->makeAsset($tenant, $this->makeCategory($tenant));

        $http->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $staff->id,
        ])->assertOk()
            ->assertJsonPath('data.assigned_to', $staff->id)
            ->assertJsonPath('data.custody_state', 'pending_acceptance')
            ->assertJsonPath('data.acknowledgement_at', null);

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'assets.acknowledgement_required',
            'status' => 'published',
        ]);
    }

    public function test_assignee_can_accept_and_peer_cannot(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);
        $asset = $this->makeAsset($tenant, $this->makeCategory($tenant));

        $adminHttp->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $staff->id,
        ])->assertOk();

        $this->actingAs($peer, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/acknowledge")
            ->assertForbidden();

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/acknowledge")
            ->assertOk()
            ->assertJsonPath('data.custody_state', 'accepted');

        $this->assertNotNull($asset->fresh()->acknowledgement_at);
    }

    public function test_assignee_can_decline_and_asset_returns_to_available(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        [$adminHttp, $admin] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $asset = $this->makeAsset($tenant, $this->makeCategory($tenant));

        $adminHttp->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $staff->id,
        ])->assertOk();

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/decline", [
                'reason' => 'Wrong person — this laptop is for the clerk.',
            ])
            ->assertOk()
            ->assertJsonPath('data.assigned_to', null)
            ->assertJsonPath('data.status', 'available')
            ->assertJsonPath('data.custody_state', null);

        $this->assertNotNull(
            AssetAssignmentHistory::where('asset_id', $asset->id)->first()?->returned_at
        );
        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'assets.assignment_declined',
            'status' => 'published',
        ]);
    }

    public function test_return_requires_request_then_officer_confirmation(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $asset = $this->makeAsset($tenant, $this->makeCategory($tenant));

        $adminHttp->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $staff->id,
        ])->assertOk();
        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/acknowledge")
            ->assertOk();

        $adminHttp->postJson("/api/v1/assets/{$asset->id}/return")
            ->assertStatus(422);

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/request-return")
            ->assertOk()
            ->assertJsonPath('data.custody_state', 'pending_return')
            ->assertJsonPath('data.assigned_to', $staff->id);

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'assets.return_requested',
            'status' => 'published',
        ]);

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/return")
            ->assertForbidden();

        $adminHttp->postJson("/api/v1/assets/{$asset->id}/return", [
            'notes' => 'Received in good condition',
            'condition' => 'good',
        ])->assertOk()
            ->assertJsonPath('data.assigned_to', null)
            ->assertJsonPath('data.status', 'available')
            ->assertJsonPath('data.custody_state', null);

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'assets.returned',
            'status' => 'published',
        ]);
    }

    public function test_create_with_assigned_to_starts_handshake(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $category = $this->makeCategory($tenant);

        $http->postJson('/api/v1/assets', [
            'asset_code' => 'AST-HS-'.uniqid(),
            'name' => 'Tablet PF/ICT/9',
            'category' => $category->code,
            'assigned_to' => $staff->id,
        ])->assertCreated()
            ->assertJsonPath('assigned_to', $staff->id)
            ->assertJsonPath('custody_state', 'pending_acceptance');

        $this->assertDatabaseHas('notification_outbox', [
            'event_type' => 'assets.acknowledgement_required',
            'status' => 'published',
        ]);
    }

    public function test_import_assign_skips_handshake(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $asset = $this->makeAsset($tenant, $this->makeCategory($tenant));

        $updated = app(\App\Modules\Assets\Services\AssetService::class)
            ->assign($asset, $staff, $admin, ['skip_handshake' => true, 'notes' => 'Imported assignment']);

        $this->assertSame('accepted', $updated->custody_state);
        $this->assertDatabaseMissing('notification_outbox', [
            'event_type' => 'assets.acknowledgement_required',
        ]);
    }
}
