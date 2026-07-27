<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetAssignmentHistory;
use App\Models\AssetCapitalisationPolicy;
use App\Models\AssetCategory;
use App\Models\AssetDisposal;
use App\Models\GoodsReceiptNote;
use App\Models\ProcurementRequest;
use App\Models\PurchaseOrder;
use App\Models\PurchaseOrderItem;
use App\Models\Tenant;
use App\Models\Vendor;
use App\Modules\Assets\Services\AssetCapitalisationPolicyService;
use App\Modules\Assets\Services\AssetService;
use Tests\TestCase;

class FixedAssetPhase1Test extends TestCase
{
    private function makeCategory(Tenant $tenant, string $code = 'equipment'): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Equipment',
            'code' => $code.'-'.uniqid(),
        ]);
    }

    private function makePendingAsset(Tenant $tenant, AssetCategory $category, array $extra = []): Asset
    {
        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => 'AST-'.uniqid(),
            'name' => 'Test Device',
            'category' => $category->code,
            'status' => 'pending',
        ], $extra));
    }

    public function test_capitalisation_policy_classifies_capital_vs_controlled(): void
    {
        $tenant = Tenant::factory()->create();
        $service = app(AssetCapitalisationPolicyService::class);
        $policy = $service->ensureDefault($tenant->id);

        $this->assertSame(250.0, (float) $policy->threshold_amount);
        $this->assertSame('capital', $service->classify(500, 3, $policy));
        $this->assertSame('controlled', $service->classify(100, 3, $policy));
        $this->assertSame('controlled', $service->classify(100, 3, $policy, true));
    }

    public function test_capitalise_applies_policy_and_sets_asset_class(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$asset->id}/capitalise", [
            'category' => $category->code,
            'purchase_date' => '2026-01-15',
            'purchase_value' => 500,
            'useful_life_years' => 3,
            'serial_number' => 'SN-CAP-1',
        ])->assertOk()
            ->assertJsonPath('data.asset_class', 'capital')
            ->assertJsonPath('data.status', 'active');

        $this->assertNotNull($asset->fresh()->capitalisation_policy_id);
        $this->assertNotNull($asset->fresh()->tag_number);
    }

    public function test_capitalise_below_threshold_is_controlled(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$asset->id}/capitalise", [
            'category' => $category->code,
            'purchase_date' => '2026-01-15',
            'purchase_value' => 120,
            'useful_life_years' => 2,
        ])->assertOk()
            ->assertJsonPath('data.asset_class', 'controlled');
    }

    public function test_grn_fixed_asset_handoff_creates_one_record_per_unit(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $vendor = Vendor::create([
            'tenant_id' => $tenant->id, 'name' => 'Supply Co',
            'is_approved' => true, 'is_active' => true,
        ]);
        $req = ProcurementRequest::create([
            'tenant_id' => $tenant->id, 'requester_id' => $staff->id,
            'title' => 'Laptops', 'description' => 'Bulk', 'category' => 'goods',
            'estimated_value' => 100000, 'currency' => 'USD', 'status' => 'awarded',
        ]);
        $po = PurchaseOrder::create([
            'tenant_id' => $tenant->id,
            'procurement_request_id' => $req->id,
            'vendor_id' => $vendor->id,
            'reference_number' => 'PO-QTY'.uniqid(),
            'title' => 'Laptops PO',
            'total_amount' => 100000,
            'currency' => 'USD',
            'status' => 'issued',
            'issued_at' => now(),
            'created_by' => $staff->id,
        ]);
        $poItem = PurchaseOrderItem::create([
            'purchase_order_id' => $po->id,
            'description' => 'Dell Laptop',
            'quantity' => 20,
            'unit' => 'unit',
            'unit_price' => 5000,
            'total_price' => 100000,
        ]);
        $grn = GoodsReceiptNote::create([
            'tenant_id' => $tenant->id,
            'purchase_order_id' => $po->id,
            'received_by' => $staff->id,
            'received_date' => now()->toDateString(),
            'status' => 'pending',
        ]);
        $grnItem = $grn->items()->create([
            'purchase_order_item_id' => $poItem->id,
            'quantity_ordered' => 20,
            'quantity_received' => 20,
            'quantity_accepted' => 20,
        ]);

        [$http] = $this->asProcurementOfficer($tenant);
        $http->postJson("/api/v1/procurement/purchase-orders/{$po->id}/receipts/{$grn->id}/accept", [
            'handoff' => [[
                'goods_receipt_item_id' => $grnItem->id,
                'type' => 'fixed_asset',
                'name' => 'Dell Laptop',
                'category' => 'equipment',
                'quantity' => 20,
            ]],
        ])->assertOk();

        $this->assertSame(20, Asset::where('tenant_id', $tenant->id)->where('goods_receipt_note_id', $grn->id)->count());
    }

    public function test_tag_uniqueness_enforced_on_capitalise(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $existing = $this->makePendingAsset($tenant, $category, ['status' => 'active', 'tag_number' => 'TAG-UNIQUE-1']);
        $pending = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$pending->id}/capitalise", [
            'category' => $category->code,
            'purchase_date' => '2026-01-15',
            'purchase_value' => 400,
            'tag_number' => 'TAG-UNIQUE-1',
        ])->assertStatus(422);
    }

    public function test_serial_duplicate_prevented_unless_overridden(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makePendingAsset($tenant, $category, [
            'status' => 'active',
            'serial_number' => 'SN-DUP-1',
        ]);
        $pending = $this->makePendingAsset($tenant, $category);

        $http->postJson("/api/v1/assets/{$pending->id}/capitalise", [
            'category' => $category->code,
            'purchase_date' => '2026-01-15',
            'purchase_value' => 400,
            'serial_number' => 'SN-DUP-1',
        ])->assertStatus(422);

        $http->postJson("/api/v1/assets/{$pending->id}/capitalise", [
            'category' => $category->code,
            'purchase_date' => '2026-01-15',
            'purchase_value' => 400,
            'serial_number' => 'SN-DUP-1',
            'allow_serial_duplicate' => true,
        ])->assertOk()
            ->assertJsonPath('data.serial_duplicate_override', true);
    }

    public function test_assignment_creates_immutable_history(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category, ['status' => 'active']);

        $http->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $staff->id,
        ])->assertOk();

        $this->assertDatabaseHas('asset_assignment_histories', [
            'asset_id' => $asset->id,
            'assigned_to' => $staff->id,
            'returned_at' => null,
        ]);

        $http->postJson("/api/v1/assets/{$asset->id}/transfer", [
            'to_user_id' => $other->id,
        ])->assertOk();

        $histories = AssetAssignmentHistory::where('asset_id', $asset->id)->orderBy('id')->get();
        $this->assertCount(2, $histories);
        $this->assertNotNull($histories[0]->returned_at);
        $this->assertNull($histories[1]->returned_at);
        $this->assertSame($other->id, (int) $asset->fresh()->assigned_to);

        // History rows are not overwritten — first assignee remains on closed row
        $this->assertSame($staff->id, (int) $histories[0]->assigned_to);
    }

    public function test_employee_can_acknowledge_assigned_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$adminHttp] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category, ['status' => 'active']);

        $adminHttp->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $staff->id,
        ])->assertOk();

        [$staffHttp] = $this->asStaff($tenant);
        // asStaff creates a different user — authenticate as the assignee
        $this->actingAs($staff, 'sanctum')
            ->postJson("/api/v1/assets/{$asset->id}/acknowledge")
            ->assertOk();

        $this->assertNotNull($asset->fresh()->acknowledgement_at);
    }

    public function test_disposal_workflow_gates_and_retains_asset(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category, ['status' => 'active']);

        $create = $http->postJson('/api/v1/asset-disposals', [
            'asset_id' => $asset->id,
            'reason' => 'obsolete',
            'justification' => 'End of life',
            'method' => 'scrap',
        ])->assertCreated();

        $id = $create->json('data.id');

        // Cannot skip to finance without HOD recommend
        $http->postJson("/api/v1/asset-disposals/{$id}/finance-review")
            ->assertStatus(422);

        $http->postJson("/api/v1/asset-disposals/{$id}/recommend", ['comments' => 'Agree'])
            ->assertOk();
        $http->postJson("/api/v1/asset-disposals/{$id}/finance-review")
            ->assertOk();
        $http->postJson("/api/v1/asset-disposals/{$id}/approve")
            ->assertOk();
        $http->postJson("/api/v1/asset-disposals/{$id}/complete", [
            'accounting_reference' => 'JV-001',
        ])->assertOk();

        $this->assertDatabaseHas('assets', [
            'id' => $asset->id,
            'status' => 'scrapped',
        ]);
        $this->assertNotNull(Asset::find($asset->id));

        $http->postJson("/api/v1/assets/{$asset->id}/assign", [
            'assigned_to' => $this->makeUser('staff', $tenant)->id,
        ])->assertStatus(422);
    }

    public function test_register_export_and_dashboard(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makePendingAsset($tenant, $category, ['status' => 'active', 'asset_class' => 'capital']);

        $http->getJson('/api/v1/assets/dashboard')->assertOk()
            ->assertJsonPath('data.capital', 1);

        $http->get('/api/v1/assets/register-export')
            ->assertOk();
    }

    public function test_outstanding_assets_filter_for_offboarding(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $category = $this->makeCategory($tenant);
        $asset = $this->makePendingAsset($tenant, $category, [
            'status' => 'assigned',
            'assigned_to' => $staff->id,
        ]);

        $http->getJson('/api/v1/assets?assigned_to='.$staff->id)
            ->assertOk()
            ->assertJsonFragment(['id' => $asset->id]);
    }
}
