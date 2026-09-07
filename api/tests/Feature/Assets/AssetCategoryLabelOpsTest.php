<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\AssetLabelTemplate;
use App\Models\Tenant;
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class AssetCategoryLabelOpsTest extends TestCase
{
    public function test_asset_creator_can_list_and_create_categories(): void
    {
        $tenant = Tenant::factory()->create();
        $creator = $this->makeUser('staff', $tenant);
        $creator->givePermissionTo(['assets.view', 'assets.create']);
        Sanctum::actingAs($creator);

        $this->getJson('/api/v1/asset-categories')->assertOk()->assertJsonPath('data', []);

        $this->postJson('/api/v1/asset-categories', [
            'name' => 'IT Equipment',
            'code' => 'it',
            'sort_order' => 10,
            'useful_life_years' => 4,
        ])->assertCreated()->assertJsonPath('data.useful_life_years', 4);

        $this->getJson('/api/v1/asset-categories')
            ->assertOk()
            ->assertJsonPath('data.0.code', 'it')
            ->assertJsonPath('data.0.useful_life_years', 4);
    }

    public function test_plain_staff_cannot_mutate_categories(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $cat = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Fleet',
            'code' => 'fleet',
        ]);
        Sanctum::actingAs($staff);

        $this->getJson('/api/v1/asset-categories')->assertForbidden();
        $this->postJson('/api/v1/asset-categories', ['name' => 'X', 'code' => 'x'])->assertForbidden();
        $this->putJson('/api/v1/asset-categories/'.$cat->id, ['name' => 'Y'])->assertForbidden();
        $this->deleteJson('/api/v1/asset-categories/'.$cat->id)->assertForbidden();
    }

    public function test_admin_can_update_category_and_cannot_delete_in_use(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $cat = AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'IT',
            'code' => 'it',
        ]);
        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-1',
            'name' => 'Laptop',
            'category' => 'it',
            'status' => 'active',
        ]);
        Sanctum::actingAs($admin);

        $this->putJson('/api/v1/asset-categories/'.$cat->id, [
            'name' => 'Information Technology',
            'useful_life_years' => 5,
        ])->assertOk()->assertJsonPath('data.name', 'Information Technology');

        $this->deleteJson('/api/v1/asset-categories/'.$cat->id)->assertStatus(422);
    }

    public function test_templates_are_seeded_on_list_without_import(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $this->assertSame(0, AssetLabelTemplate::query()->where('tenant_id', $tenant->id)->count());

        $res = $this->getJson('/api/v1/assets/labels/templates')->assertOk();
        $this->assertGreaterThanOrEqual(3, count($res->json('data')));
        $this->assertNotNull(collect($res->json('data'))->firstWhere('code', 'avery_l7161_permanent'));
    }

    public function test_admin_can_create_and_update_label_template_geometry(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);

        $created = $this->postJson('/api/v1/assets/labels/templates', [
            'code' => 'custom_avery',
            'name' => 'Custom Avery',
            'kind' => 'permanent',
            'page_width_mm' => 210,
            'page_height_mm' => 297,
            'margin_top_mm' => 8,
            'margin_left_mm' => 4,
            'label_width_mm' => 63.5,
            'label_height_mm' => 46.6,
            'h_gap_mm' => 2.5,
            'v_gap_mm' => 0,
            'rows' => 6,
            'columns' => 3,
            'font_pt' => 8,
            'qr_mm' => 20,
        ])->assertCreated();

        $id = $created->json('data.id');

        $this->putJson('/api/v1/assets/labels/templates/'.$id, [
            'name' => 'Custom Avery 18mm QR',
            'qr_mm' => 18,
            'font_pt' => 9,
        ])->assertOk()
            ->assertJsonPath('data.name', 'Custom Avery 18mm QR')
            ->assertJsonPath('data.qr_mm', 18);
    }

    public function test_staff_cannot_edit_templates(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        Sanctum::actingAs($admin);
        $id = $this->getJson('/api/v1/assets/labels/templates')->json('data.0.id');

        $staff = $this->makeUser('staff', $tenant);
        Sanctum::actingAs($staff);
        $this->putJson('/api/v1/assets/labels/templates/'.$id, ['name' => 'Hacked'])->assertForbidden();
    }

    public function test_print_pdf_works_after_auto_seeded_templates(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $asset = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'CE-4242',
            'tag_number' => 'CE-4242',
            'name' => 'Printer',
            'category' => 'it',
            'status' => 'active',
        ]);
        Sanctum::actingAs($admin);

        $templateId = $this->getJson('/api/v1/assets/labels/templates')
            ->assertOk()
            ->json('data.0.id');

        $res = $this->post('/api/v1/assets/labels/print', [
            'asset_ids' => [$asset->id],
            'template_id' => $templateId,
        ]);
        $res->assertOk();
        $this->assertStringContainsString('pdf', strtolower($res->headers->get('content-type', '')));
        $this->assertSame('printed', $asset->fresh()->label_status);
        $this->assertGreaterThan(100, strlen($res->getContent()));
    }
}
