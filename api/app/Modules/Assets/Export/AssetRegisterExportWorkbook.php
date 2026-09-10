<?php

namespace App\Modules\Assets\Export;

use Illuminate\Support\Collection;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;

final class AssetRegisterExportWorkbook
{
    public const FILENAME_PREFIX = 'fixed-asset-register-';

    /**
     * @param  Collection<int, \App\Models\Asset>  $rows
     */
    public function __construct(private readonly Collection $rows) {}

    public function write(string $path): void
    {
        $spreadsheet = $this->build();
        (new Xlsx($spreadsheet))->save($path);
        $spreadsheet->disconnectWorksheets();
    }

    public function stream(string $output): void
    {
        $spreadsheet = $this->build();
        (new Xlsx($spreadsheet))->save($output);
        $spreadsheet->disconnectWorksheets();
    }

    public function build(): Spreadsheet
    {
        $spreadsheet = new Spreadsheet;
        $sheet = $spreadsheet->getActiveSheet();
        $sheet->setTitle('Register');
        $headers = [
            'asset_code', 'tag_number', 'name', 'category', 'asset_class', 'status',
            'serial_number', 'purchase_date', 'purchase_value', 'funding_source',
            'useful_life_years', 'book_value', 'location', 'assigned_to',
        ];
        $sheet->fromArray($headers, null, 'A1');
        $sheet->getStyle('A1:'.$sheet->getHighestColumn().'1')->applyFromArray([
            'font' => ['bold' => true, 'color' => ['rgb' => 'FFFFFF']],
            'fill' => [
                'fillType' => Fill::FILL_SOLID,
                'startColor' => ['rgb' => '1F4E79'],
            ],
            'alignment' => ['wrapText' => true, 'vertical' => Alignment::VERTICAL_CENTER],
        ]);
        $sheet->freezePane('A2');

        $data = [];
        foreach ($this->rows as $r) {
            $purchaseDate = $r->purchase_date;
            $data[] = [
                $r->asset_code,
                $r->tag_number,
                $r->name,
                $r->category,
                $r->asset_class,
                $r->status,
                $r->serial_number,
                is_object($purchaseDate) && method_exists($purchaseDate, 'toDateString')
                    ? $purchaseDate->toDateString()
                    : (is_string($purchaseDate) ? substr($purchaseDate, 0, 10) : null),
                $r->purchase_value,
                $r->funding_source,
                $r->useful_life_years,
                $r->book_value ?? $r->current_value,
                $r->location?->name,
                $r->assignedUser?->name,
            ];
        }
        if ($data !== []) {
            $sheet->fromArray($data, null, 'A2');
        }
        foreach (range(1, count($headers)) as $col) {
            $sheet->getColumnDimensionByColumn($col)->setWidth(18);
        }
        $sheet->getColumnDimension('C')->setWidth(32);
        $sheet->getColumnDimension('N')->setWidth(28);
        $sheet->getRowDimension(1)->setRowHeight(22);

        return $spreadsheet;
    }
}
