<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetHandover;
use App\Models\AssetLocation;
use App\Models\AssetSubcategory;
use App\Models\Tenant;
use Tests\TestCase;

class AssetPhase2OpsTest extends TestCase
{
    private function seedCategory(Tenant $tenant): void
    {
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => 'ICT',
            'useful_life_years' => 3,
        ]);
        AssetSubcategory::create([
            'tenant_id' => $tenant->id,
            'asset_category_id' => $category->id,
            'code' => 'LT',
            'name' => 'Laptop',
        ]);
    }

    private function makeAvailableAsset(Tenant $tenant, array $attrs = []): Asset
    {
        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => 'PF-'.uniqid(),
            'tag_number' => 'PF/ICT/LT/'.random_int(1000, 9999),
            'name' => 'Dell Latitude',
            'category' => 'ICT',
            'status' => 'available',
            'custodian_type' => 'location',
            'qr_token' => 'qr_'.bin2hex(random_bytes(6)),
        ], $attrs));
    }

    public function test_scan_basket_accepts_qr_and_nfc_then_starts_draft_handover(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $this->seedCategory($tenant);
        $qrAsset = $this->makeAvailableAsset($tenant);
        $nfcAsset = $this->makeAvailableAsset($tenant, ['nfc_uid' => '04AABBCCDDEE']);

        $basket = $http->postJson('/api/v1/assets/scan-baskets', [])->assertCreated();
        $id = $basket->json('data.id');

        $http->postJson("/api/v1/assets/scan-baskets/{$id}/items", ['token' => $qrAsset->qr_token])
            ->assertCreated();
        $http->postJson("/api/v1/assets/scan-baskets/{$id}/items", ['nfc_uid' => '04AABBCCDDEE'])
            ->assertCreated();
        $dup = $http->postJson("/api/v1/assets/scan-baskets/{$id}/items", ['token' => $qrAsset->qr_token]);
        $dup->assertStatus(422);

        $started = $http->postJson("/api/v1/assets/scan-baskets/{$id}/start-handover", [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $this->makeUser('staff', $tenant)->id,
        ]);
        $started->assertCreated();
        $this->assertSame('draft', $started->json('data.status'));
        $this->assertCount(2, $started->json('data.lines'));
        $this->assertNull($started->json('data.accepted_at'));
    }

    public function test_kit_and_parent_child_never_self_parent(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->seedCategory($tenant);
        $parent = $this->makeAvailableAsset($tenant, ['name' => 'Docking station']);
        $child = $this->makeAvailableAsset($tenant, ['name' => 'Laptop']);

        $http->postJson("/api/v1/assets/{$child->id}/parent", ['parent_asset_id' => $child->id])
            ->assertStatus(422);

        $http->postJson("/api/v1/assets/{$child->id}/parent", ['parent_asset_id' => $parent->id])
            ->assertOk()
            ->assertJsonPath('data.parent_asset_id', $parent->id);

        $kit = $http->postJson('/api/v1/asset-kits', [
            'name' => 'New starter laptop kit',
            'asset_ids' => [$parent->id, $child->id],
        ])->assertCreated();
        $this->assertCount(2, $kit->json('data.items'));
        $this->assertSame('New starter laptop kit', $kit->json('data.name'));
    }

    public function test_room_qr_lists_assets_at_location_without_finance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $location = AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'RM-1',
            'name' => 'Board room',
            'is_active' => true,
        ]);
        $this->makeAvailableAsset($tenant, [
            'location_id' => $location->id,
            'purchase_value' => 99999,
        ]);

        $issued = $http->postJson("/api/v1/asset-locations/{$location->id}/room-token")->assertOk();
        $token = $issued->json('data.qr_token');
        $this->assertNotEmpty($token);

        $room = $http->getJson("/api/v1/assets/rooms/{$token}")->assertOk();
        $this->assertSame('Board room', $room->json('data.location.name'));
        $this->assertCount(1, $room->json('data.assets'));
        $this->assertArrayNotHasKey('purchase_value', $room->json('data.assets.0'));
    }

    public function test_role_equipment_template_reports_gaps(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $http->postJson('/api/v1/asset-equipment-templates', [
            'name' => 'Programme officer kit',
            'role_name' => 'staff',
            'required_categories' => ['ICT'],
        ])->assertCreated();

        $gap = $http->getJson("/api/v1/asset-equipment-templates/gaps?user_id={$staff->id}")
            ->assertOk();
        $this->assertNotEmpty($gap->json('data.missing_categories'));
        $this->assertContains('ICT', $gap->json('data.missing_categories'));
    }

    public function test_attestation_campaign_records_custodian_confirm_without_mutating_ownership(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $asset = $this->makeAvailableAsset($tenant, [
            'status' => 'assigned',
            'assigned_to' => $staff->id,
            'custodian_type' => 'person',
        ]);

        $campaign = $http->postJson('/api/v1/asset-attestations', [
            'name' => '2026 annual custody',
            'due_on' => now()->addMonth()->toDateString(),
        ])->assertCreated();

        $this->asUser($staff);
        $this->postJson('/api/v1/asset-attestations/'.$campaign->json('data.id').'/attest', [
            'asset_ids' => [$asset->id],
            'confirmed' => true,
        ])->assertOk();

        $asset->refresh();
        $this->assertSame('assigned', $asset->status);
        $this->assertSame($staff->id, (int) $asset->assigned_to);
        $this->assertSame('SADC Parliamentary Forum', $http->getJson('/api/v1/assets/'.$asset->id)->json('data.owner')
            ?? 'SADC Parliamentary Forum');
    }

    public function test_planner_slot_creates_draft_handover_and_never_auto_completes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $asset = $this->makeAvailableAsset($tenant);

        $slot = $http->postJson('/api/v1/asset-planner/slots', [
            'asset_id' => $asset->id,
            'to_user_id' => $staff->id,
            'notes' => 'Q4 rotation',
        ])->assertCreated();

        $this->assertSame('draft', $slot->json('data.handover.status'));
        $this->assertNull($slot->json('data.handover.accepted_at'));
        $asset->refresh();
        $this->assertSame('available', $asset->status);
        $this->assertNull($asset->assigned_to);
    }

    public function test_delegate_can_sign_but_custody_opens_to_recipient(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $recipient = $this->makeUser('staff', $tenant);
        $delegate = $this->makeUser('staff', $tenant);
        $asset = $this->makeAvailableAsset($tenant);

        $created = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $recipient->id,
            'delegate_user_id' => $delegate->id,
            'asset_ids' => [$asset->id],
        ])->assertCreated();
        $id = $created->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$id}/send")->assertOk();

        $this->asUser($delegate);
        $lineId = $created->json('data.lines.0.id') ?? AssetHandover::find($id)->lines()->value('id');
        $this->postJson("/api/v1/asset-handovers/{$id}/lines/{$lineId}/respond", [
            'response' => 'received',
        ])->assertOk();
        $this->postJson("/api/v1/asset-handovers/{$id}/sign", ['comment' => 'Collected for colleague'])
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted');

        $asset->refresh();
        $this->assertSame($recipient->id, (int) $asset->assigned_to);
        $this->assertNotSame($delegate->id, (int) $asset->assigned_to);
    }

    public function test_paper_fallback_is_manager_only_and_opens_custody(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $recipient = $this->makeUser('staff', $tenant);
        $asset = $this->makeAvailableAsset($tenant);

        $created = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $recipient->id,
            'asset_ids' => [$asset->id],
        ])->assertCreated();
        $id = $created->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$id}/send")->assertOk();
        $lineId = AssetHandover::find($id)->lines()->value('id');
        $http->postJson("/api/v1/asset-handovers/{$id}/lines/{$lineId}/respond", [
            'response' => 'received',
        ])->assertOk();

        $this->asUser($recipient);
        $this->postJson("/api/v1/asset-handovers/{$id}/paper-sign", [
            'paper_receipt_number' => 'PF-PAPER-1',
        ])->assertForbidden();

        $this->asAdmin($tenant);
        $this->postJson("/api/v1/asset-handovers/{$id}/paper-sign", [
            'paper_receipt_number' => 'PF-PAPER-1',
        ])->assertOk()->assertJsonPath('data.status', 'accepted');

        $asset->refresh();
        $this->assertSame($recipient->id, (int) $asset->assigned_to);
        $this->assertSame('PF-PAPER-1', AssetHandover::find($id)->paper_receipt_number);
    }

    public function test_staff_without_asset_manage_cannot_create_kits(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->asUser($staff);
        $this->postJson('/api/v1/asset-kits', ['name' => 'Nope'])->assertForbidden();
    }
}
