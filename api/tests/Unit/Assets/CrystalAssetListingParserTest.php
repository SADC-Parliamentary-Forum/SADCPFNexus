<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Import\AssetCategoryMapper;
use App\Modules\Assets\Import\AssetDescriptionParser;
use App\Modules\Assets\Import\CrystalAssetListingParser;
use App\Modules\Assets\Import\NexusAssetTemplateParser;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xls;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\TestCase;

class CrystalAssetListingParserTest extends TestCase
{
    public function test_parses_real_category_and_location_listings(): void
    {
        $parser = new CrystalAssetListingParser;
        $category = $parser->parseFile(
            dirname(__DIR__, 2).'/Fixtures/asset-register/2036_Fixed_Assets_Listing_Category_31_March_2026.xls',
            'category.xls'
        );
        $location = $parser->parseFile(
            dirname(__DIR__, 2).'/Fixtures/asset-register/2026_Fixed_Assets_Listing_Location_31_March_2026.xls',
            'location.xls'
        );

        $catTags = collect($category['records'])->pluck('asset_tag')->unique()->values();
        $locTags = collect($location['records'])->pluck('asset_tag')->unique()->values();

        $this->assertSame(CrystalAssetListingParser::KIND_CATEGORY, $category['kind']);
        $this->assertSame(CrystalAssetListingParser::KIND_LOCATION, $location['kind']);
        $this->assertCount(323, $catTags);
        $this->assertCount(323, $locTags);
        $this->assertContains('FF-0172', $catTags->all());
        $this->assertContains('FF-0172', $locTags->all());
        $this->assertContains('CE-0092', $catTags->all());

        $ce = collect($category['records'])->firstWhere('asset_tag', 'CE-0092');
        $this->assertNotNull($ce);
        $this->assertEqualsWithDelta(22434.78, (float) $ce['opening_cost'], 0.01);
        $this->assertEqualsWithDelta(17760.88, (float) $ce['closing_book_value'], 0.01);
        $this->assertNotEmpty($ce['raw']);
    }

    public function test_skips_headers_footers_and_reads_multiline_synthetic_crystal(): void
    {
        $path = $this->writeCrystalXls([
            ['SADC PF Fixed Assets Listing'],
            ['From Asset ID', 'CE-0001'],
            ['From Cost Center', 'HO'],
            ['Category: Computer Equipment'],
            ['CE-0001', '', '', '', 1000, '', '', 0, '', 0, '', 0, '', '', 1000, '', 100, 10, 0, '', 110, 0, 0, 0, 890],
            ['Asset Description: HP ZBOOK 15 G6 S/N ABCDE12345', '', '', '', '', '', '', '', '', '', '', '', 'Acquisition Date: 03/31/2020'],
            ['Subtotal :'],
            ['Category: Ofice Equipment'],
            ['OE-0001', '', '', '', 0.0, '', '', 0.0, '', 0.0, '', 0.0, '', '', 0.0, '', 0.0, 0.0, 0.0, '', 0.0, 0.0, 0.0, 0.0, 0.0],
            ['Asset Description: Projector', '', '', '', '', '', '', '', '', '', '', '', 'Acquisition Date:'],
        ]);

        $parsed = (new CrystalAssetListingParser)->parseFile($path, 'synthetic.xls');
        unlink($path);

        $this->assertCount(2, $parsed['records']);
        $this->assertSame('CE-0001', $parsed['records'][0]['asset_tag']);
        $this->assertSame('Computer Equipment', $parsed['records'][0]['legacy_category']);
        $this->assertSame('2020-03-31', $parsed['records'][0]['acquisition_date']);
        $this->assertEqualsWithDelta(0.0, (float) $parsed['records'][1]['opening_cost'], 0.001);
        $this->assertNotEmpty($parsed['skipped']);
    }

    public function test_template_parser_requires_headers_and_keeps_blank_tags(): void
    {
        $path = sys_get_temp_dir().'/nexus-asset-template-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'serial_number'],
            ['CE-1001', 'Laptop', 'SN-1'],
            ['', 'No tag', ''],
        ]);
        (new Xlsx($sheet))->save($path);

        $rows = (new NexusAssetTemplateParser)->parseFile($path, 'template.xlsx');
        unlink($path);

        $this->assertCount(2, $rows);
        $this->assertSame('CE-1001', $rows[0]['asset_tag']);
        $this->assertNull($rows[1]['asset_tag']);
        $this->assertSame('No tag', $rows[1]['asset_name']);
    }

    public function test_description_parser_never_invents_unknown_or_na_serials(): void
    {
        $parser = new AssetDescriptionParser;
        $hp = $parser->parse('HP ZBOOK 15 G6 S/N CNU1234567 - Laptop');
        $this->assertSame('HP', $hp['make']);
        $this->assertSame('CNU1234567', $hp['serial']);

        $na = $parser->parse('Old chair S/N N/A');
        $this->assertNull($na['serial']);
        $this->assertContains('MISSING_SERIAL', $na['flags']);
    }

    public function test_category_mapper_includes_held_for_sale_and_office_typo(): void
    {
        $this->assertSame('it', AssetCategoryMapper::toCode('Computer Equipment'));
        $this->assertSame('household', AssetCategoryMapper::toCode('Household Furniture & Fittings'));
        $this->assertSame('land_buildings', AssetCategoryMapper::toCode('Land & Buildings'));
        $this->assertSame('held_for_sale', AssetCategoryMapper::toCode('Assets Held for Sale'));
        $this->assertSame('equipment', AssetCategoryMapper::toCode('Ofice Equipment'));
        $this->assertSame('fleet', AssetCategoryMapper::toCode('Motor Vehicles'));
    }

    public function test_formula_merged_cells_negative_and_zero_amounts(): void
    {
        $path = sys_get_temp_dir().'/crystal-formula-'.uniqid().'.xls';
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->fromArray([
            ['SADC PF Fixed Assets Listing'],
            ['Category: Computer Equipment'],
            ['CE-4001', '', '', '', null, '', '', 0, '', 0, '', 0, '', '', 0, '', 0, 0, 0, '', 0, 0, 0, 0, 0],
            ['Asset Description: Formula laptop', '', '', '', '', '', '', '', '', '', '', '', 'Acquisition Date: 01/15/2021'],
            ['CE-4002', '', '', '', -12.5, '', '', 0, '', 0, '', 0, '', '', -12.5, '', 0, 0, 0, '', 0, 0, 0, 0, -12.5],
            ['Asset Description: Credit note monitor', '', '', '', '', '', '', '', '', '', '', '', 'Acquisition Date:'],
        ]);
        $sheet->setCellValue('E3', '=1000+234.78');
        $sheet->mergeCells('A3:B3');
        (new Xls($spreadsheet))->save($path);

        $parsed = (new CrystalAssetListingParser)->parseFile($path, 'formula.xls');
        unlink($path);

        $this->assertCount(2, $parsed['records']);
        $this->assertSame('CE-4001', $parsed['records'][0]['asset_tag']);
        $this->assertEqualsWithDelta(1234.78, (float) $parsed['records'][0]['opening_cost'], 0.01);
        $this->assertEqualsWithDelta(-12.5, (float) $parsed['records'][1]['opening_cost'], 0.01);
    }

    /**
     * @param  list<list<mixed>>  $rows
     */
    private function writeCrystalXls(array $rows): string
    {
        $path = sys_get_temp_dir().'/crystal-'.uniqid().'.xls';
        $spreadsheet = new Spreadsheet;
        $spreadsheet->getActiveSheet()->fromArray($rows);
        (new Xls($spreadsheet))->save($path);

        return $path;
    }
}
