<?php

namespace App\Modules\Assets\Import;

use OpenSpout\Reader\XLSX\Reader as XlsxReader;
use PhpOffice\PhpSpreadsheet\Cell\Coordinate;
use PhpOffice\PhpSpreadsheet\IOFactory;
use PhpOffice\PhpSpreadsheet\Shared\Date as ExcelDate;
use PhpOffice\PhpSpreadsheet\Worksheet\Worksheet;

/**
 * Loads an XLS/XLSX worksheet into a simple row/column grid.
 *
 * BIFF .xls uses PhpSpreadsheet. Clean XLSX uses OpenSpout (ZIP/PK magic),
 * including upload temp paths that may lack a .xlsx extension.
 */
final class SpreadsheetGrid
{
    /**
     * @return array{sheet: string, rows: list<list<mixed>>}
     */
    public static function loadFirstSheet(string $path): array
    {
        $sheets = self::loadAllSheets($path);

        return $sheets[0] ?? ['sheet' => 'Sheet1', 'rows' => []];
    }

    /**
     * @return list<array{sheet: string, rows: list<list<mixed>>}>
     */
    public static function loadAllSheets(string $path): array
    {
        if (self::shouldUseOpenSpout($path)) {
            return self::loadXlsxWithOpenSpout($path);
        }

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

    public static function shouldUseOpenSpout(string $path): bool
    {
        $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (in_array($ext, ['xls', 'xlt'], true)) {
            return false;
        }

        $handle = @fopen($path, 'rb');
        $magic = $handle ? (string) fread($handle, 4) : '';
        if ($handle) {
            fclose($handle);
        }
        if (str_starts_with($magic, 'PK')) {
            return true;
        }

        return in_array($ext, ['xlsx', 'xlsm'], true);
    }

    /**
     * @return list<array{sheet: string, rows: list<list<mixed>>}>
     */
    private static function loadXlsxWithOpenSpout(string $path): array
    {
        $reader = new XlsxReader;
        $reader->open($path);
        try {
            $out = [];
            foreach ($reader->getSheetIterator() as $sheet) {
                $rows = [];
                foreach ($sheet->getRowIterator() as $row) {
                    $cells = [];
                    foreach ($row->toArray() as $value) {
                        $cells[] = self::normalizeCell($value);
                    }
                    $rows[] = $cells;
                }
                $out[] = [
                    'sheet' => $sheet->getName(),
                    'rows' => $rows,
                ];
            }

            return $out;
        } finally {
            $reader->close();
        }
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
                try {
                    $value = $cell->getCalculatedValue();
                } catch (\Throwable) {
                    $value = $cell->getValue();
                }
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

    private static function normalizeCell(mixed $value): mixed
    {
        if ($value instanceof \DateTimeInterface) {
            return $value->format('Y-m-d');
        }

        return $value;
    }
}
