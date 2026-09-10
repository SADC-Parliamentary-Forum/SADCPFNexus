<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use PhpOffice\PhpSpreadsheet\IOFactory;
use Tests\TestCase;

class AssetRegisterExportTest extends TestCase
{
    private function makeCategory(Tenant $tenant, string $code = 'equipment'): AssetCategory
    {
        return AssetCategory::create([
            'tenant_id' => $tenant->id,
            'name' => 'Equipment',
            'code' => $code.'-'.uniqid(),
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

    public function test_xlsx_export_includes_only_requested_ids(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $keep = $this->makeAsset($tenant, $category, ['name' => 'Keep Me', 'asset_code' => 'KEEP-1']);
        $this->makeAsset($tenant, $category, ['name' => 'Skip Me', 'asset_code' => 'SKIP-1']);
        $pending = $this->makeAsset($tenant, $category, [
            'name' => 'Pending Draft',
            'asset_code' => 'PEND-1',
            'status' => 'pending',
        ]);

        $res = $http->get('/api/v1/assets/register-export?format=xlsx&include_pending=1&ids='.$keep->id.','.$pending->id)
            ->assertOk();

        $this->assertStringContainsString(
            'spreadsheetml.sheet',
            (string) $res->headers->get('content-type'),
        );

        $path = sys_get_temp_dir().'/asset-register-export-'.uniqid().'.xlsx';
        file_put_contents($path, $res->streamedContent());
        $sheet = IOFactory::load($path)->getActiveSheet();
        $values = $sheet->toArray(null, true, true, true);
        unlink($path);

        $codes = [];
        foreach ($values as $i => $row) {
            if ($i === 1) {
                continue;
            }
            $codes[] = (string) ($row['A'] ?? '');
        }
        $this->assertContains('KEEP-1', $codes);
        $this->assertContains('PEND-1', $codes);
        $this->assertNotContains('SKIP-1', $codes);
    }

    public function test_default_csv_export_still_succeeds(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $this->makeAsset($tenant, $category);

        $http->get('/api/v1/assets/register-export')->assertOk();
    }

    public function test_staff_without_assets_view_cannot_export_register(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->get('/api/v1/assets/register-export?format=json')->assertForbidden();
    }

    public function test_assets_view_can_export_register(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->givePermissionTo('assets.view');
        $http = $this->asUser($user);

        $http->getJson('/api/v1/assets/register-export?format=json')->assertOk();
    }

    public function test_json_export_applies_status_and_search_when_ids_omitted(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $keep = $this->makeAsset($tenant, $category, ['name' => 'Keep Laptop', 'asset_code' => 'KEEP-F1', 'status' => 'active']);
        $this->makeAsset($tenant, $category, ['name' => 'Other Laptop', 'asset_code' => 'SKIP-F1', 'status' => 'retired']);
        $this->makeAsset($tenant, $category, ['name' => 'Office Chair', 'asset_code' => 'SKIP-F2', 'status' => 'active']);

        $codes = collect(
            $http->getJson('/api/v1/assets/register-export?format=json&include_pending=1&status=active&search=Keep')
                ->assertOk()
                ->json('data')
        )->pluck('asset_code')->all();

        $this->assertContains($keep->asset_code, $codes);
        $this->assertNotContains('SKIP-F1', $codes);
        $this->assertNotContains('SKIP-F2', $codes);
    }

    public function test_live_status_excludes_retired_and_disposed_on_list_and_export(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $category = $this->makeCategory($tenant);
        $live = $this->makeAsset($tenant, $category, ['asset_code' => 'LIVE-1', 'status' => 'active']);
        $pending = $this->makeAsset($tenant, $category, ['asset_code' => 'LIVE-P', 'status' => 'pending']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'DEAD-R', 'status' => 'retired']);
        $this->makeAsset($tenant, $category, ['asset_code' => 'DEAD-D', 'status' => 'disposed']);

        $listed = collect(
            $http->getJson('/api/v1/assets?status=live&per_page=100')
                ->assertOk()
                ->json('data')
        )->pluck('asset_code')->all();

        $this->assertContains($live->asset_code, $listed);
        $this->assertContains($pending->asset_code, $listed);
        $this->assertNotContains('DEAD-R', $listed);
        $this->assertNotContains('DEAD-D', $listed);

        $exported = collect(
            $http->getJson('/api/v1/assets/register-export?format=json&status=live')
                ->assertOk()
                ->json('data')
        )->pluck('asset_code')->all();

        $this->assertContains($live->asset_code, $exported);
        $this->assertContains($pending->asset_code, $exported);
        $this->assertNotContains('DEAD-R', $exported);
        $this->assertNotContains('DEAD-D', $exported);
    }
}
