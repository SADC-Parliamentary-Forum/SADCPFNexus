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
}
