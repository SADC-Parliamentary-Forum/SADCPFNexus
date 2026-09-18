<?php

namespace Tests\Feature\Assets;

use App\Models\Asset;
use App\Models\Tenant;
use Illuminate\Support\Facades\Artisan;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Tests\TestCase;

class ReplaceAssetRegisterCommandTest extends TestCase
{
    public function test_replace_register_clears_then_imports_template(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->forceFill(['name' => 'Boemo Sekgoma'])->save();

        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'OLD-1',
            'tag_number' => 'OLD-1',
            'name' => 'Obsolete demo asset',
            'category' => 'it',
            'status' => 'active',
        ]);

        $path = sys_get_temp_dir().'/replace-far-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'legacy_category', 'legacy_location', 'custodian_candidate', 'original_cost'],
            ['CE-0001', 'HP laser Jet Printer P2055dn', 'Computer Equipment', 'USM-Office#16A', 'Boemo Sekgoma', '2,472.00'],
        ]);
        (new Xlsx($sheet))->save($path);

        $exit = Artisan::call('assets:replace-register', [
            '--force' => true,
            '--tenant' => $tenant->id,
            '--file' => $path,
        ]);
        unlink($path);

        $this->assertSame(0, $exit);
        $this->assertSame(0, Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'OLD-1')->count());
        $imported = Asset::query()->where('tenant_id', $tenant->id)->where('tag_number', 'CE-0001')->first();
        $this->assertNotNull($imported);
        $this->assertSame('it', $imported->category);
        $this->assertSame($admin->id, (int) $imported->assigned_to);
        $this->assertEquals(2472.0, (float) $imported->purchase_value);
    }

    public function test_replace_register_refuses_without_force(): void
    {
        $this->assertNotSame(0, Artisan::call('assets:replace-register'));
    }
}
