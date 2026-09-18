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
            NexusAssetTemplateParser::HEADERS,
            [
                'AS-0001',
                "SG's house Erosweg 66",
                '',
                '',
                '',
                'Assets Held for Sale',
                '2017-03-31',
                '4,352,608.70',
                '4,001,873.08',
                '350,735.62',
                'NAD',
                '',
                'ErosWeg, Windhoek',
                '',
                '',
                "SG's house Erosweg 66",
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
        $this->assertSame('Unaro Mungendje', $rows[1]['custodian_candidate']);
    }
}
