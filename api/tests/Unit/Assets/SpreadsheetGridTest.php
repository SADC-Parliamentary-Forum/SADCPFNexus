<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Import\SpreadsheetGrid;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\TestCase;

class SpreadsheetGridTest extends TestCase
{
    public function test_xlsx_is_detected_by_zip_magic_even_without_extension(): void
    {
        $path = $this->writeXlsx([['asset_tag', 'asset_name'], ['CE-1001', 'Laptop']]);
        $this->assertTrue(SpreadsheetGrid::shouldUseOpenSpout($path));

        $copied = sys_get_temp_dir().'/grid-noext-'.uniqid();
        copy($path, $copied);
        $this->assertTrue(SpreadsheetGrid::shouldUseOpenSpout($copied));

        $loaded = SpreadsheetGrid::loadFirstSheet($copied);
        $this->assertSame('asset_tag', $loaded['rows'][0][0]);
        $this->assertSame('CE-1001', $loaded['rows'][1][0]);

        unlink($path);
        unlink($copied);
    }

    public function test_biff_xls_does_not_use_openspout(): void
    {
        $path = sys_get_temp_dir().'/grid-biff-'.uniqid().'.xls';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([['Asset ID'], ['CE-0001']]);
        (new Xls($sheet))->save($path);

        $this->assertFalse(SpreadsheetGrid::shouldUseOpenSpout($path));
        $loaded = SpreadsheetGrid::loadFirstSheet($path);
        $this->assertSame('CE-0001', $loaded['rows'][1][0]);
        unlink($path);
    }

    public function test_staging_fixture_xlsx_loads_named_sheets(): void
    {
        $path = dirname(__DIR__, 2).'/Fixtures/asset-register/Nexus_Asset_Register_Import_Staging.xlsx';
        $this->assertTrue(SpreadsheetGrid::shouldUseOpenSpout($path));
        $sheets = SpreadsheetGrid::loadAllSheets($path);
        $names = array_map(fn ($s) => $s['sheet'], $sheets);
        $this->assertContains('Asset_Import', $names);
        $this->assertContains('Location_User_Mapping', $names);
    }

    /**
     * @param  list<list<mixed>>  $rows
     */
    private function writeXlsx(array $rows): string
    {
        $path = sys_get_temp_dir().'/grid-xlsx-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray($rows);
        (new Xlsx($sheet))->save($path);

        return $path;
    }
}
