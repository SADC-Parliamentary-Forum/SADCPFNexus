<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCategory;
use App\Models\AssetConditionAssessment;
use App\Models\AssetHandover;
use App\Models\AssetHandoverLine;
use App\Models\AssetLocation;
use App\Models\AssetSubcategory;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Assets\Services\AssetQrService;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class AssetIssuanceHandoverTest extends TestCase
{
    private function seedCategory(Tenant $tenant, string $code = 'ICT'): AssetCategory
    {
        $category = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'ICT Equipment',
            'code' => $code,
            'useful_life_years' => 3,
        ]);
        AssetSubcategory::create([
            'tenant_id' => $tenant->id,
            'asset_category_id' => $category->id,
            'code' => 'LT',
            'name' => 'Laptop',
        ]);

        return $category;
    }

    public function test_batch_creates_n_numbered_available_store_assets_without_rewriting_tags(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->seedCategory($tenant);
        $existing = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'LEGACY-KEEP',
            'tag_number' => 'PF/ICT/OLD/099',
            'name' => 'Existing laptop',
            'category' => 'ICT',
            'status' => 'available',
        ]);

        $create = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Dell Latitude lot',
            'qty' => 2,
            'unit_cost' => 15000,
            'category' => 'ICT',
            'subcategory_code' => 'LT',
            'supplier_name' => 'Demo Supplier',
            'invoice_number' => 'INV-1',
        ]);
        $create->assertCreated();
        $batchId = $create->json('data.id');

        $created = $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", [
            'name' => 'Dell Latitude',
        ]);
        $created->assertOk();
        $this->assertSame(2, $created->json('data.progress.created'));
        $this->assertSame(2, $created->json('data.progress.still_available'));

        $assets = Asset::query()->where('acquisition_batch_id', $batchId)->orderBy('id')->get();
        $this->assertCount(2, $assets);
        foreach ($assets as $asset) {
            $this->assertSame('available', $asset->status);
            $this->assertNull($asset->assigned_to);
            $this->assertSame('location', $asset->custodian_type);
            $this->assertMatchesRegularExpression('#^PF/ICT/LT/\d+$#', (string) $asset->tag_number);
            $this->assertSame('INV-1', $asset->invoice_number);
            $this->assertSame('Demo Supplier', $asset->supplier_name);
        }
        $this->assertSame('PF/ICT/OLD/099', $existing->fresh()->tag_number);

        $http->getJson("/api/v1/asset-batches/{$batchId}")
            ->assertOk()
            ->assertJsonPath('data.progress.created', 2);
    }

    public function test_issue_handover_reserves_then_unsigned_lines_do_not_open_custody(): void
    {
        Mail::fake();
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $this->seedCategory($tenant);

        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 2, 'category' => 'ICT', 'subcategory_code' => 'LT',
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", ['name' => 'Laptop'])->assertOk();
        $ids = Asset::query()->where('acquisition_batch_id', $batchId)->pluck('id')->all();

        $ho = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $staff->id,
            'asset_ids' => $ids,
        ]);
        $ho->assertCreated();
        $handoverId = $ho->json('data.id');

        $http->postJson("/api/v1/asset-handovers/{$handoverId}/send")->assertOk()
            ->assertJsonPath('data.status', 'awaiting_acceptance');

        foreach ($ids as $id) {
            $this->assertSame($handoverId, Asset::find($id)->reserved_handover_id);
            $this->assertNull(Asset::find($id)->assigned_to);
        }

        $line = AssetHandoverLine::query()->where('handover_id', $handoverId)->where('asset_id', $ids[0])->first();
        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/asset-handovers/{$handoverId}/lines/{$line->id}/respond", [
                'response' => 'received',
            ])->assertOk();

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/asset-handovers/{$handoverId}/sign", ['auth_level' => 'password'])
            ->assertOk();

        $accepted = Asset::find($ids[0]);
        $unsigned = Asset::find($ids[1]);
        $this->assertSame($staff->id, $accepted->assigned_to);
        $this->assertNull($accepted->reserved_handover_id);
        $this->assertNull($unsigned->assigned_to);
        $this->assertNull($unsigned->reserved_handover_id);
        $this->assertSame('available', $unsigned->status);
    }

    public function test_partial_accept_and_dispute_does_not_overwrite_condition_snapshot(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $this->seedCategory($tenant);
        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 2, 'category' => 'ICT', 'subcategory_code' => 'LT',
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", [
            'name' => 'Laptop', 'condition' => 'good',
        ])->assertOk();
        $assets = Asset::query()->where('acquisition_batch_id', $batchId)->orderBy('id')->get();

        $handoverId = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $staff->id,
            'asset_ids' => $assets->pluck('id')->all(),
        ])->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$handoverId}/send")->assertOk();

        $ok = AssetHandoverLine::query()->where('handover_id', $handoverId)->where('asset_id', $assets[0]->id)->first();
        $bad = AssetHandoverLine::query()->where('handover_id', $handoverId)->where('asset_id', $assets[1]->id)->first();
        $this->assertSame('good', $bad->condition_out);

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/asset-handovers/{$handoverId}/lines/{$ok->id}/respond", ['response' => 'received'])
            ->assertOk();
        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/asset-handovers/{$handoverId}/lines/{$bad->id}/respond", [
                'response' => 'condition_different',
                'dispute_notes' => 'Crack on lid',
                'condition_in' => 'poor',
            ])->assertOk();

        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/asset-handovers/{$handoverId}/sign")
            ->assertOk()
            ->assertJsonPath('data.status', 'partially_accepted');

        $this->assertSame('good', $bad->fresh()->condition_out);
        $this->assertDatabaseHas('asset_condition_assessments', [
            'asset_id' => $assets[1]->id,
            'previous_condition' => 'good',
            'new_condition' => 'poor',
        ]);
        $this->assertSame($staff->id, $assets[0]->fresh()->assigned_to);
        $this->assertNull($assets[1]->fresh()->assigned_to);
        $this->assertSame('available', $assets[1]->fresh()->status);
        $this->assertSame(1, AssetConditionAssessment::query()->where('asset_id', $assets[1]->id)->count());
    }

    public function test_person_transfer_and_return_close_custody_periods_with_durations(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $first = $this->makeUser('staff', $tenant);
        $second = $this->makeUser('staff', $tenant);
        $this->seedCategory($tenant);
        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 1, 'category' => 'ICT', 'subcategory_code' => 'LT',
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", ['name' => 'Laptop'])->assertOk();
        $asset = Asset::query()->where('acquisition_batch_id', $batchId)->first();

        $issueId = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue', 'custody_target_type' => 'person',
            'to_user_id' => $first->id, 'asset_ids' => [$asset->id],
        ])->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$issueId}/send")->assertOk();
        $line = AssetHandoverLine::query()->where('handover_id', $issueId)->first();
        $this->actingAs($first, 'sanctum')->postJson("/api/v1/asset-handovers/{$issueId}/lines/{$line->id}/respond", ['response' => 'received'])->assertOk();
        $this->actingAs($first, 'sanctum')->postJson("/api/v1/asset-handovers/{$issueId}/sign")->assertOk();

        $this->travel(2)->days();

        $transferId = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'transfer', 'custody_target_type' => 'person',
            'from_user_id' => $first->id, 'to_user_id' => $second->id, 'asset_ids' => [$asset->id],
        ])->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$transferId}/send")->assertOk();
        $tLine = AssetHandoverLine::query()->where('handover_id', $transferId)->first();
        $this->actingAs($second, 'sanctum')->postJson("/api/v1/asset-handovers/{$transferId}/lines/{$tLine->id}/respond", ['response' => 'received'])->assertOk();
        $this->actingAs($second, 'sanctum')->postJson("/api/v1/asset-handovers/{$transferId}/sign")->assertOk();

        $this->travel(1)->days();

        $returnId = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'return', 'custody_target_type' => 'location',
            'from_user_id' => $second->id, 'asset_ids' => [$asset->id],
        ])->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$returnId}/send")->assertOk()
            ->assertJsonPath('data.status', 'return_initiated');
        $http->postJson("/api/v1/asset-handovers/{$returnId}/sign")->assertOk();

        $history = $http->getJson("/api/v1/assets/{$asset->id}/custody-history")->assertOk()->json('data.history');
        $this->assertGreaterThanOrEqual(2, count($history));
        $closed = collect($history)->filter(fn ($row) => ! empty($row['ended_at']));
        $this->assertTrue($closed->every(fn ($row) => $row['duration_seconds'] !== null));
        $this->assertSame('available', $asset->fresh()->status);
        $this->assertNull($asset->fresh()->assigned_to);
        $this->assertSame('SADC Parliamentary Forum', $http->getJson("/api/v1/assets/{$asset->id}/custody-history")->json('data.owner'));
    }

    public function test_location_target_completes_without_saam(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->seedCategory($tenant);
        $room = AssetLocation::create([
            'tenant_id' => $tenant->id,
            'code' => 'ROOM1',
            'name' => 'Committee Room 1',
            'location_type' => 'room',
            'is_active' => true,
        ]);
        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 1, 'category' => 'ICT', 'subcategory_code' => 'LT',
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", ['name' => 'Projector'])->assertOk();
        $asset = Asset::query()->where('acquisition_batch_id', $batchId)->first();

        $handoverId = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue',
            'custody_target_type' => 'location',
            'to_location_id' => $room->id,
            'asset_ids' => [$asset->id],
        ])->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$handoverId}/send")
            ->assertOk()
            ->assertJsonPath('data.status', 'accepted')
            ->assertJsonPath('data.signature_event_id', null);

        $fresh = $asset->fresh();
        $this->assertNull($fresh->assigned_to);
        $this->assertSame('location', $fresh->custodian_type);
        $this->assertSame($room->id, $fresh->location_id);
        $this->assertNull($fresh->reserved_handover_id);
        $this->assertNull(AssetHandover::find($handoverId)?->signature_event_id);
    }

    public function test_deactivated_user_cannot_be_person_target(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $this->seedCategory($tenant);
        $gone = $this->makeUser('staff', $tenant);
        $gone->is_active = false;
        $gone->account_status = User::STATUS_OFFBOARDED;
        $gone->save();
        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 1, 'category' => 'ICT', 'subcategory_code' => 'LT',
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", ['name' => 'Laptop'])->assertOk();
        $asset = Asset::query()->where('acquisition_batch_id', $batchId)->first();

        $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue',
            'custody_target_type' => 'person',
            'to_user_id' => $gone->id,
            'asset_ids' => [$asset->id],
        ])->assertStatus(422);
    }

    public function test_public_qr_still_redacts_and_financials_remain_sod(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $this->seedCategory($tenant);
        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 1, 'category' => 'ICT', 'subcategory_code' => 'LT', 'unit_cost' => 9999,
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", ['name' => 'Laptop'])->assertOk();
        $asset = Asset::query()->where('acquisition_batch_id', $batchId)->first();
        app(AssetQrService::class)->ensure($asset, $admin);

        $this->getJson('/api/v1/public/assets/'.$asset->qr_token)
            ->assertOk()
            ->assertJsonMissingPath('data.serial_number')
            ->assertJsonMissingPath('data.custodian')
            ->assertJsonMissingPath('data.purchase_value');

        $officer = $this->makeUser('Administration Officer', $tenant);
        $shown = $this->actingAs($officer, 'sanctum')
            ->getJson('/api/v1/assets/'.$asset->id)
            ->assertOk()
            ->json();
        $purchase = $shown['data']['purchase_value'] ?? $shown['purchase_value'] ?? null;
        $this->assertNull($purchase);
    }

    public function test_second_issue_blocked_while_reserved_and_print_labels_path_exists(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $this->seedCategory($tenant);
        $batchId = $http->postJson('/api/v1/asset-batches', [
            'description' => 'Lot', 'qty' => 1, 'category' => 'ICT', 'subcategory_code' => 'LT',
        ])->json('data.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/create-assets", ['name' => 'Laptop'])->assertOk();
        $asset = Asset::query()->where('acquisition_batch_id', $batchId)->first();

        $templates = $http->getJson('/api/v1/assets/labels/templates')->assertOk();
        $templateId = $templates->json('data.0.id');
        $http->postJson("/api/v1/asset-batches/{$batchId}/print-labels", [
            'template_id' => $templateId,
            'json' => true,
        ])->assertCreated();

        $first = $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue', 'custody_target_type' => 'person',
            'to_user_id' => $staff->id, 'asset_ids' => [$asset->id],
        ])->json('data.id');
        $http->postJson("/api/v1/asset-handovers/{$first}/send")->assertOk();

        $other = $this->makeUser('staff', $tenant);
        $http->postJson('/api/v1/asset-handovers', [
            'type' => 'issue', 'custody_target_type' => 'person',
            'to_user_id' => $other->id, 'asset_ids' => [$asset->id],
        ])->assertStatus(422);

        $http->getJson('/api/v1/assets/handovers/register')->assertOk();
        $this->assertGreaterThan(0, AssetAssignmentHistory::query()->count() + AssetHandover::query()->count());
    }
}
