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
            'A9',
            '7. assigned_to is the staff member currently using/holding the asset (full name). Nexus matches that name, or assigned_to_email, to a live staff account. In the app, assignment is a searchable dropdown of name, email and department.'
        );
        $sheet->setCellValue(
            'A10',
            '8. assigned_to_email is optional. Use a live staff email when available to match the person to a Nexus user.'
        );
        $sheet->setCellValue(
            'A12',
            '10. department is captured from the matched staff record when blank, or kept from this column when provided.'
        );
        $sheet->setCellValue(
            'C30',
            'Staff member currently using or holding the asset. Matched by full name or email. In the app this is a searchable dropdown showing name, email and department.'
        );
        $sheet->setCellValue(
            'C31',
            'Optional staff email. Matched to a user in this organisation; blank uses assigned_to name matching.'
        );
        $sheet->setCellValue(
            'C33',
            'Organisational unit. Filled from the matched staff member when this cell is blank.'
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
        $assets->getColumnDimension('M')->setWidth(28);
        $assets->getColumnDimension('N')->setWidth(28);
        $assets->getColumnDimension('O')->setWidth(28);
        $assets->getColumnDimension('R')->setWidth(36);
        $assets->getRowDimension(1)->setRowHeight(22);
        $assets->getComment('A1')->getText()->createTextRun('Required. Unique asset tag / code (e.g. CE-0001).');
        $assets->getComment('B1')->getText()->createTextRun('Required. Short name shown on the register.');
        $assets->getComment('G1')->getText()->createTextRun('Use YYYY-MM-DD (e.g. 2024-03-01).');
        $assets->getComment('N1')->getText()->createTextRun('Staff full name. Matched to a Nexus user on import; searchable in the app with email and department.');
        $assets->getComment('O1')->getText()->createTextRun('Optional. Staff email in this organisation. Matched to a user on import; leave blank to match by assigned_to name.');

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
            ['6. legacy_category examples: Computer Equipment, Office Equipment, Motor Vehicles, Furniture, Land & Buildings.'],
            ['7. assigned_to is the staff member currently using/holding the asset (full name). Nexus matches that name, or assigned_to_email, to a live staff account. In the app, assignment is a searchable dropdown of name, email and department.'],
            ['8. assigned_to_email is optional. Use a live staff email when available to match the person to a Nexus user.'],
            ['9. location is the current physical location of the asset.'],
            ['10. department is captured from the matched staff record when blank, or kept from this column when provided.'],
            ['11. Save as .xlsx and upload on Assets → Import (Standard template).'],
            ['12. Review staged rows, resolve staff/location/department mappings if prompted, then commit to the register.'],
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
            ['asset_owner', 'Yes', 'Legal/institutional owner of the asset. For this register: SADC Parliamentary Forum.'],
            ['assigned_to', 'No', 'Staff member currently using or holding the asset. Matched by full name or email.'],
            ['assigned_to_email', 'No', 'Optional staff email. Blank uses assigned_to name matching.'],
            ['location', 'No', 'Physical location of the asset (mapped during review).'],
            ['department', 'No', 'Organisational unit. Filled from the matched staff member when blank.'],
            ['legacy_description', 'No', 'Longer source description if different from the name.'],
        ], null, 'A1');
        $instructions->getStyle('A1')->getFont()->setBold(true)->setSize(14);
        $instructions->getStyle('A16:C16')->getFont()->setBold(true);
        $instructions->getColumnDimension('A')->setWidth(28);
        $instructions->getColumnDimension('B')->setWidth(12);
        $instructions->getColumnDimension('C')->setWidth(62);

        $spreadsheet->setActiveSheetIndex(0);

        return $spreadsheet;
    }
}
