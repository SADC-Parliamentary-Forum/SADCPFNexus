<?php

namespace Tests\Unit\Assets;

use App\Modules\Assets\Import\NexusAssetTemplateParser;
use App\Modules\Assets\Import\NexusAssetTemplateWorkbook;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use PHPUnit\Framework\TestCase;

class NexusAssetTemplateParserTest extends TestCase
{
    public function test_parses_comma_formatted_money_from_template_rows(): void
    {
        $path = sys_get_temp_dir().'/far-money-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            [
                'asset_tag',
                'asset_name',
                'legacy_category',
                'acquisition_date',
                'original_cost',
                'current_book_value',
                'accumulated_depreciation',
                'location',
            ],
            [
                'AS-0001',
                "SG's house Erosweg 66",
                'Assets Held for Sale',
                '2017-03-31',
                '4,352,608.70',
                '4,001,873.08',
                '350,735.62',
                'ErosWeg, Windhoek',
            ],
        ]);
        (new Xlsx($sheet))->save($path);

        $rows = (new NexusAssetTemplateParser)->parseFile($path, 'far.xlsx');
        unlink($path);

        $this->assertCount(1, $rows);
        $this->assertSame('AS-0001', $rows[0]['asset_tag']);
        $this->assertSame(4352608.70, $rows[0]['original_cost']);
        $this->assertSame(4001873.08, $rows[0]['current_book_value']);
        $this->assertSame(350735.62, $rows[0]['accumulated_depreciation']);
        $this->assertSame(
            'held_for_sale',
            \App\Modules\Assets\Import\AssetCategoryMapper::toCode($rows[0]['legacy_category'])
        );
    }

    public function test_official_march_2026_listing_is_the_downloadable_template(): void
    {
        $this->assertFileExists(NexusAssetTemplateWorkbook::officialPath());

        $rows = (new NexusAssetTemplateParser)->parseFile(
            NexusAssetTemplateWorkbook::officialPath(),
            NexusAssetTemplateWorkbook::FILENAME,
        );

        $this->assertGreaterThanOrEqual(300, count($rows));
        $this->assertSame('AS-0001', $rows[0]['asset_tag']);
        $this->assertSame('CE-0001', $rows[1]['asset_tag']);
        $this->assertSame(4352608.70, $rows[0]['original_cost']);
        $this->assertSame('Computer Equipment', $rows[1]['legacy_category']);
        $this->assertSame('SADC Parliamentary Forum', $rows[1]['asset_owner']);
        $this->assertSame('Unaro Mungendje', $rows[1]['assigned_to']);
        $this->assertSame('Unaro Mungendje', $rows[1]['custodian_candidate']);
        $this->assertSame('USM-Office#16A', $rows[1]['location']);
        $this->assertSame('USM-Office#16A', $rows[1]['legacy_location']);
        $this->assertContains('assigned_to', NexusAssetTemplateParser::HEADERS);
        $this->assertContains('assigned_to_email', NexusAssetTemplateParser::HEADERS);
        $this->assertContains('location', NexusAssetTemplateParser::HEADERS);
        $this->assertContains('department', NexusAssetTemplateParser::HEADERS);
        $this->assertContains('asset_owner', NexusAssetTemplateParser::HEADERS);
    }

    public function test_assignment_field_headers_alias_onto_legacy_import_keys(): void
    {
        $path = sys_get_temp_dir().'/far-assign-'.uniqid().'.xlsx';
        $sheet = new Spreadsheet;
        $sheet->getActiveSheet()->fromArray([
            ['asset_tag', 'asset_name', 'asset_owner', 'assigned_to', 'assigned_to_email', 'location', 'department'],
            ['CE-9001', 'HP ZBook', 'SADC Parliamentary Forum', 'Unaro Mungendje', 'unaro@sadcpf.org', 'USM-Office#16A', 'ICT'],
        ]);
        (new Xlsx($sheet))->save($path);

        $rows = (new NexusAssetTemplateParser)->parseFile($path, 'assign.xlsx');
        unlink($path);

        $this->assertCount(1, $rows);
        $this->assertSame('Unaro Mungendje', $rows[0]['assigned_to']);
        $this->assertSame('Unaro Mungendje', $rows[0]['custodian_candidate']);
        $this->assertSame('unaro@sadcpf.org', $rows[0]['assigned_to_email']);
        $this->assertSame('USM-Office#16A', $rows[0]['location']);
        $this->assertSame('USM-Office#16A', $rows[0]['legacy_location']);
        $this->assertSame('ICT', $rows[0]['department']);
        $this->assertSame('SADC Parliamentary Forum', $rows[0]['asset_owner']);
    }
}
