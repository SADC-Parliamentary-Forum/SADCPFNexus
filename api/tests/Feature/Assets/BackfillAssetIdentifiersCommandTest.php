<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class BackfillAssetIdentifiersCommandTest extends TestCase
{
    private function workbook(): string
    {
        $path = sys_get_temp_dir().'/backfill-ids-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'legacy_category', 'legacy_description'],
            ['CE-0003', 'HP Laser Jet Printer P2055dn S/N CNCGB22289', 'Computer Equipment', 'HP Laser Jet Printer P2055dn S/N CNCGB22289'],
            ['CE-0076', 'HP 15s i5 Laptop - Ser.No. 5CD144HSKY', 'Computer Equipment', 'HP 15s i5 Laptop - Ser.No. 5CD144HSKY'],
            ['CE-0091', 'HP FIREFLY 14 G11 - Laptop - Ms. C. Musonda', 'Computer Equipment', 'HP FIREFLY 14 G11 - Laptop - Ms. C. Musonda'],
        ]);
        (new Xlsx($sheet))->save($path);

        return $path;
    }

    private function asset(Tenant $tenant, string $tag, string $name, array $extra = []): Asset
    {
        return Asset::create(array_merge([
            'tenant_id' => $tenant->id,
            'asset_code' => $tag,
            'tag_number' => $tag,
            'name' => $name,
            'category' => 'it',
            'status' => 'active',
        ], $extra));
    }

    public function test_dry_run_reports_without_writing(): void
    {
        $tenant = Tenant::factory()->create();
        $printer = $this->asset($tenant, 'CE-0003', 'HP Laser Jet Printer P2055dn S/N CNCGB22289');
        $path = $this->workbook();

        $exit = Artisan::call('assets:backfill-identifiers', ['--tenant' => $tenant->id, '--file' => $path]);
        unlink($path);

        $this->assertSame(0, $exit);
        $this->assertStringContainsString('1 serial(s), 1 model(s), 1 make(s) to fill, 1 name(s) to clean', Artisan::output());
        $this->assertNull($printer->fresh()->serial_number);
        $this->assertSame('HP Laser Jet Printer P2055dn S/N CNCGB22289', $printer->fresh()->name);
    }

    public function test_apply_fills_blanks_cleans_names_and_keeps_existing_values(): void
    {
        $tenant = Tenant::factory()->create();
        $printer = $this->asset($tenant, 'CE-0003', 'HP Laser Jet Printer P2055dn S/N CNCGB22289');
        $laptop = $this->asset($tenant, 'CE-0076', 'HP 15s i5 Laptop - Ser.No. 5CD144HSKY', ['model' => 'Kept model']);
        $firefly = $this->asset($tenant, 'CE-0091', 'HP FIREFLY 14 G11 - Laptop - Ms. C. Musonda');
        $path = $this->workbook();

        $exit = Artisan::call('assets:backfill-identifiers', ['--tenant' => $tenant->id, '--file' => $path, '--apply' => true]);
        unlink($path);

        $this->assertSame(0, $exit);
        $printer->refresh();
        $this->assertSame('CNCGB22289', $printer->serial_number);
        $this->assertSame('Laser Jet Printer P2055dn', $printer->model);
        $this->assertSame('HP', $printer->manufacturer);
        $this->assertSame('HP Laser Jet Printer P2055dn', $printer->name);

        $laptop->refresh();
        $this->assertSame('5CD144HSKY', $laptop->serial_number);
        $this->assertSame('Kept model', $laptop->model);
        $this->assertSame('HP 15s i5 Laptop', $laptop->name);

        $firefly->refresh();
        $this->assertNull($firefly->serial_number);
        $this->assertSame('FIREFLY 14 G11', $firefly->model);
        $this->assertSame('HP FIREFLY 14 G11 - Laptop - Ms. C. Musonda', $firefly->name);
    }
}
