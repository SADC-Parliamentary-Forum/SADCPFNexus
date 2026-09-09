<?php

namespace App\Modules\Assets\Import;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

/**
 * Official SADC PF Nexus bulk-upload workbook for the asset register.
 */
final class NexusAssetTemplateWorkbook
{
    public const FILENAME = 'sadcpf-asset-import-template.xlsx';

    public function write(string $path): void
    {
        $spreadsheet = $this->build();
        (new Xlsx($spreadsheet))->save($path);
        $spreadsheet->disconnectWorksheets();
    }

    public function build(): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $assets = $spreadsheet->getActiveSheet();
        $assets->setTitle('Assets');
        $headers = NexusAssetTemplateParser::HEADERS;
        $assets->fromArray($headers, null, 'A1');
        $assets->getStyle('A1:'.$assets->getHighestColumn().'1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1F4E79'],
            ],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $assets->freezePane('A2');
        $assets->setAutoFilter('A1:'.$assets->getHighestColumn().'1');
        foreach (range(1, count($headers)) as $col) {
            $assets->getColumnDimensionByColumn($col)->setWidth(18);
        }
        $assets->getColumnDimension('B')->setWidth(28);
        $assets->getColumnDimension('O')->setWidth(28);
        $assets->getColumnDimension('P')->setWidth(36);
        $assets->getRowDimension(1)->setRowHeight(22);
        $assets->getComment('A1')->getText()->createTextRun('Required. Unique asset tag / code (e.g. CE-0001).');
        $assets->getComment('B1')->getText()->createTextRun('Required. Short name shown on the register.');
        $assets->getComment('G1')->getText()->createTextRun('Use YYYY-MM-DD (e.g. 2024-03-01).');
        $assets->getComment('O1')->getText()->createTextRun('Optional. Staff email in this organisation. Matched to a user on import; leave blank to leave unassigned.');

        $instructions = $spreadsheet->createSheet();
        $instructions->setTitle('Instructions');
        $instructions->fromArray([
            ['SADC PF Nexus — Fixed asset bulk upload'],
            [''],
            ['1. Download this workbook from Assets → Import.'],
            ['2. Keep the header row on the Assets sheet. Do not rename columns.'],
            ['3. Fill one row per asset. Leave unused rows blank — blank rows are ignored.'],
            ['4. Required columns: asset_tag, asset_name.'],
            ['5. Dates must be YYYY-MM-DD. Amounts are numeric (NAD unless currency is set).'],
            ['6. legacy_category examples: Computer Equipment, Office Equipment, Motor Vehicles, Furniture, Land & Buildings.'],
            ['7. assigned_to_email is optional. Use a live staff email to assign custody; leave blank to leave the asset unassigned.'],
            ['8. Save as .xlsx and upload on Assets → Import (Standard template).'],
            ['9. Review staged rows, map locations/custodians if prompted, then commit to the register.'],
            [''],
            ['Column', 'Required', 'Meaning'],
            ['asset_tag', 'Yes', 'Unique tag or code. Becomes the register asset code.'],
            ['asset_name', 'Yes', 'Display name.'],
            ['serial_number', 'No', 'Manufacturer serial. Leave blank if unknown.'],
            ['make', 'No', 'Manufacturer / brand.'],
            ['model', 'No', 'Model name.'],
            ['legacy_category', 'No', 'Category label; mapped to a Nexus class on import.'],
            ['acquisition_date', 'No', 'Purchase or in-service date (YYYY-MM-DD).'],
            ['original_cost', 'No', 'Acquisition cost.'],
            ['current_book_value', 'No', 'Net book value at import.'],
            ['accumulated_depreciation', 'No', 'Accumulated depreciation at import.'],
            ['currency', 'No', 'ISO code. Defaults to NAD.'],
            ['funding_source', 'No', 'Donor or budget line, if known.'],
            ['legacy_location', 'No', 'Current location name (mapped during review).'],
            ['custodian_candidate', 'No', 'Person, department, or store name to match later.'],
            ['assigned_to_email', 'No', 'Optional staff email. Matched to a user in this organisation; blank leaves the asset unassigned.'],
            ['legacy_description', 'No', 'Longer source description if different from the name.'],
            [''],
            ['Example (copy onto Assets, then replace with live data)'],
            NexusAssetTemplateParser::HEADERS,
            [
                'CE-0001',
                'HP ZBook 15',
                'CNU1234567',
                'HP',
                'ZBook 15 G6',
                'Computer Equipment',
                '2020-03-31',
                '22434.78',
                '17760.88',
                '4673.90',
                'NAD',
                'Core budget',
                'Head Office ICT',
                'ICT Department',
                'jane.officer@sadcpf.org',
                'HP ZBOOK 15 G6 S/N CNU1234567',
            ],
        ], null, 'A1');
        $instructions->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $instructions->getStyle('A13:C13')->getFont()->setBold(true);
        $instructions->getColumnDimension('A')->setWidth(28);
        $instructions->getColumnDimension('B')->setWidth(12);
        $instructions->getColumnDimension('C')->setWidth(62);

        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }
}
