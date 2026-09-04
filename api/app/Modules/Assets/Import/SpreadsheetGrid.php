<?php

namespace App\Modules\Assets\Import;

use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Loads an XLS/XLSX worksheet into a simple row/column grid.
 */
final class SpreadsheetGrid
{
    /**
     * @return array{sheet: string, rows: list<list<mixed>>}
     */
    public static function loadFirstSheet(string $path): array
    {
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);
        $sheet = $spreadsheet->getSheet(0);

        return [
            'sheet' => $sheet->getTitle(),
            'rows' => self::worksheetToRows($sheet),
        ];
    }

    /**
     * @return list<array{sheet: string, rows: list<list<mixed>>}>
     */
    public static function loadAllSheets(string $path): array
    {
        $reader = IOFactory::createReaderForFile($path);
        $reader->setReadDataOnly(true);
        $spreadsheet = $reader->load($path);
        $out = [];
        foreach ($spreadsheet->getAllSheets() as $sheet) {
            $out[] = [
                'sheet' => $sheet->getTitle(),
                'rows' => self::worksheetToRows($sheet),
            ];
        }

        return $out;
    }

    /**
     * @return list<list<mixed>>
     */
    private static function worksheetToRows(Worksheet $sheet): array
    {
        $highestRow = $sheet->getHighestDataRow();
        $highestCol = Coordinate::columnIndexFromString($sheet->getHighestDataColumn());
        $rows = [];
        for ($r = 1; $r <= $highestRow; $r++) {
            $row = [];
            for ($c = 1; $c <= $highestCol; $c++) {
                $cell = $sheet->getCell(Coordinate::stringFromColumnIndex($c).$r);
                $value = $cell->getValue();
                if ($value instanceof \DateTimeInterface) {
                    $value = $value->format('Y-m-d');
                } elseif (is_numeric($value) && ExcelDate::isDateTime($cell)) {
                    try {
                        $dt = ExcelDate::excelToDateTimeObject((float) $value);
                        $value = $dt->format('Y-m-d');
                    } catch (\Throwable) {
                        // keep numeric
                    }
                }
                $row[] = $value;
            }
            $rows[] = $row;
        }

        return $rows;
    }
}
