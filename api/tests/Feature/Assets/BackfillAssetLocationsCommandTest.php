<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\AssetLocation;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class BackfillAssetLocationsCommandTest extends TestCase
{
    private function workbook(): string
    {
        $path = sys_get_temp_dir().'/backfill-loc-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'legacy_category', 'location'],
            ['CE-0001', 'Printer', 'Computer Equipment', 'USM-Office#16A'],
            ['CE-0002', 'Laptop', 'Computer Equipment', 'Boardroom'],
            ['CE-0003', 'Desk', 'Furniture', 'SG-Residence'],
        ]);
        (new Xlsx($sheet))->save($path);

        return $path;
    }

    private function asset(Tenant $tenant, string $tag, ?string $legacy = null): Asset
    {
        return Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => $tag,
            'tag_number' => $tag,
            'name' => $tag,
            'category' => 'it',
            'status' => 'active',
            'legacy_location' => $legacy,
        ]);
    }

    public function test_dry_run_reports_without_writing(): void
    {
        $tenant = Tenant::factory()->create();
        $missing = $this->asset($tenant, 'CE-0001');
        $path = $this->workbook();

        $exit = Artisan::call('assets:backfill-locations', ['--tenant' => $tenant->id, '--file' => $path]);
        unlink($path);

        $this->assertSame(0, $exit);
        $this->assertStringContainsString('1 without a location, 1 fillable', Artisan::output());
        $this->assertNull($missing->fresh()->legacy_location);
    }

    public function test_apply_fills_only_assets_without_a_location(): void
    {
        $tenant = Tenant::factory()->create();
        $boardroom = AssetLocation::create([
            'tenant_id' => $tenant->id, 'code' => 'boardroom', 'name' => 'Boardroom',
            'location_type' => 'meeting_room', 'is_active' => true,
        ]);
        $plain = $this->asset($tenant, 'CE-0001');
        $mapped = $this->asset($tenant, 'CE-0002');
        $kept = $this->asset($tenant, 'CE-0003', 'Store Room # 5');
        $unknown = $this->asset($tenant, 'XX-9999');
        $path = $this->workbook();

        $exit = Artisan::call('assets:backfill-locations', ['--tenant' => $tenant->id, '--file' => $path, '--apply' => true]);
        unlink($path);

        $this->assertSame(0, $exit);
        $this->assertSame('USM-Office#16A', $plain->fresh()->legacy_location);
        $this->assertNull($plain->fresh()->location_id);
        $this->assertSame('Boardroom', $mapped->fresh()->legacy_location);
        $this->assertSame($boardroom->id, $mapped->fresh()->location_id);
        $this->assertSame('Store Room # 5', $kept->fresh()->legacy_location);
        $this->assertNull($unknown->fresh()->legacy_location);
    }
}
