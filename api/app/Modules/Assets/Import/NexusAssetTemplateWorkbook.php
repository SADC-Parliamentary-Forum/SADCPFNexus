<?php

namespace App\Modules\Assets\Import;

use PhpOffice\PhpSpreadsheet\IOFactory;
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

    public static function officialPath(): string
    {
        return dirname(__DIR__, 4).'/resources/assets/'.self::FILENAME;
    }

    public function write(string $path): void
    {
        $spreadsheet = $this->build();
        (new Xlsx($spreadsheet))->save($path);
        $spreadsheet->disconnectWorksheets();
    }

    public function build(): Spreadsheet
    {
        $official = self::officialPath();
        if (is_file($official)) {
            $spreadsheet = IOFactory::load($official);
            $this->refreshInstructions($spreadsheet);
            $spreadsheet->setActiveSheetIndex(0);

            return $spreadsheet;
        }

        return $this->emptyWorkbook();
    }

    private function refreshInstructions(Spreadsheet $spreadsheet): void
    {
        $sheet = $spreadsheet->getSheetByName('Instructions');
        if ($sheet === null) {
            return;
        }
        $sheet->setCellValue('A1', 'SADC PF Nexus — Fixed asset bulk upload (31 March 2026 listing)');
        $sheet->setCellValue(
            'A8',
            '6. legacy_category examples from this listing: Office Furniture & Fittings, Computer Equipment, Household Furniture & Fittings, Office Equipment, Land & Buildings, Motor Vehicles, Assets Held for Sale.'
        );
        $sheet->setCellValue(
            'A9',
            '7. assigned_to_email is optional. custodian_candidate should be the staff full name (matched on import) or a live staff email.'
        );
        $sheet->setCellValue(
            'A27',
            'Person or store name. Matched to a staff account by full name; otherwise mapped during review.'
        );
        $sheet->setCellValue(
            'C28',
            'Optional staff email. Matched to a user in this organisation; blank uses custodian_candidate name matching.'
        );
    }

    private function emptyWorkbook(): Spreadsheet
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
            ['5. Dates must be YYYY-MM-DD. Amounts are numeric (NAD unless currency is set). Thousands separators are allowed.'],
            ['6. legacy_category examples: Office Furniture & Fittings, Computer Equipment, Household Furniture & Fittings, Office Equipment, Land & Buildings, Motor Vehicles, Assets Held for Sale.'],
            ['7. assigned_to_email is optional. custodian_candidate should be the staff full name (matched on import) or a live staff email.'],
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
            ['custodian_candidate', 'No', 'Person or store name. Matched to a staff account by full name.'],
            ['assigned_to_email', 'No', 'Optional staff email. Blank uses custodian_candidate name matching.'],
            ['legacy_description', 'No', 'Longer source description if different from the name.'],
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
