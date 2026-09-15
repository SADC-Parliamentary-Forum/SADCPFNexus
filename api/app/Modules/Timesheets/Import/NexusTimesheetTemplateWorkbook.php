<?php

namespace App\Modules\Timesheets\Import;

use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

final class NexusTimesheetTemplateWorkbook
{
    public const FILENAME = 'nexus-timesheet-bulk-upload-template.xlsx';

    public const VERSION = 1;

    /** @var list<string> */
    public const HEADERS = [
        'employee_id',
        'employee_email',
        'employee_name',
        'project',
        'workplan_item',
        'activity',
        'description',
        'department',
        'programme',
        'funding_source',
        'donor',
        'location',
        'tags',
        'start_date',
        'end_date',
        'start_time',
        'end_time',
        'hours',
        'type',
        'source',
        'external_reference',
        'original_created_date',
    ];

    public function write(string $path): void
    {
        $spreadsheet = $this->build();
        (new Xlsx($spreadsheet))->save($path);
        $spreadsheet->disconnectWorksheets();
    }

    public function build(): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Timesheets');
        $sheet->fromArray(self::HEADERS, null, 'A1');
        $sheet->getStyle('A1:'.$sheet->getHighestColumn().'1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1F4E79'],
            ],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->freezePane('A2');
        $sheet->setAutoFilter('A1:'.$sheet->getHighestColumn().'1');
        foreach (range(1, count(self::HEADERS)) as $col) {
            $sheet->getColumnDimensionByColumn($col)->setWidth(18);
        }
        $sheet->fromArray([
            '', 'staff@sadcpf.org', 'Example Staff', 'SRHR Programme', '', 'Policy drafting',
            'Prepared briefing note for Standing Committee', 'Programmes', '', '', '', 'Windhoek', '',
            '2025-09-10', '2025-09-10', '08:00', '12:00', '4.00', 'Normal', 'Clockify', '', '2025-09-10',
        ], null, 'A2');

        $instructions = $spreadsheet->createSheet();
        $instructions->setTitle('Instructions');
        $instructions->fromArray([
            ['SADC PF Nexus — Timesheet bulk upload'],
            [''],
            ['1. Keep the header row. Do not rename columns on the Timesheets sheet.'],
            ['2. Dates must be YYYY-MM-DD. Times may be HH:MM or HH:MM:SS.'],
            ['3. Hours are decimal (e.g. 7.50). If start and end times are supplied, hours may be derived.'],
            ['4. Type must be Normal or Overtime. Weekend work is not automatically overtime.'],
            ['5. Ordinary employees may only import their own rows. Email mismatches are rejected.'],
            ['6. Clockify Detailed Time Report files can be uploaded as-is — do not restructure them.'],
            ['7. Billable Clockify columns are stored as source metadata, not payroll.'],
            [''],
            ['Column', 'Required', 'Meaning'],
            ['employee_email', 'Admin multi-user', 'Primary identity key. Ignored on self-import except to detect mismatches.'],
            ['employee_id', 'Optional', 'Nexus user id when known.'],
            ['start_date', 'Yes', 'Work date (or start of a multi-day Clockify interval).'],
            ['hours', 'Yes unless times given', 'Decimal duration.'],
            ['activity', 'Yes', 'What was worked on.'],
            ['description', 'Yes', 'Explain the work performed.'],
            ['type', 'No', 'Normal (default) or Overtime.'],
        ], null, 'A1');
        $instructions->getColumnDimension('A')->setWidth(28);
        $instructions->getColumnDimension('B')->setWidth(22);
        $instructions->getColumnDimension('C')->setWidth(72);

        $mapping = $spreadsheet->createSheet();
        $mapping->setTitle('Clockify mapping');
        $mapping->fromArray([
            ['Clockify field', 'Nexus treatment'],
            ['Project', 'Project (legacy/unmapped kept as original_project)'],
            ['Department', 'Department source metadata'],
            ['Description', 'Description'],
            ['Activity / Task', 'Activity'],
            ['User', 'Employee name (not an identity key)'],
            ['Email', 'Employee identification'],
            ['Tags', 'Tags'],
            ['Start Date / Start Time', 'Start'],
            ['End Date / End Time', 'End; multi-day rows are split at midnight'],
            ['Duration (decimal)', 'Hours'],
            ['Duration (h)', 'Source metadata'],
            ['Date of creation', 'Original created date'],
            ['Billable / Rate / Amount', 'Source metadata only — not payroll'],
        ], null, 'A1');
        $mapping->getColumnDimension('A')->setWidth(28);
        $mapping->getColumnDimension('B')->setWidth(64);

        return $spreadsheet;
    }
}
