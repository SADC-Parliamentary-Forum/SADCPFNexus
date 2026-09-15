<?php

namespace App\Modules\Timesheets\Import;

use OpenSpout\Reader\XLSX\Reader as XlsxReader;

final class TimesheetSpreadsheetLoader
{
    /**
     * Load the first data sheet as a list of rows (including header).
     * Formulas are never calculated — OpenSpout returns stored values only.
     *
     * @return list<list<mixed>>
     */
    public static function load(string $path, string $extension): array
    {
        $ext = strtolower($extension);
        if (in_array($ext, ['csv', 'txt'], true)) {
            return self::loadCsv($path);
        }
        if ($ext === 'xlsx') {
            return self::loadXlsx($path);
        }

        throw new \InvalidArgumentException('Only CSV and XLSX files are accepted.');
    }

    /**
     * @return list<list<mixed>>
     */
    private static function loadCsv(string $path): array
    {
        $handle = fopen($path, 'rb');
        if ($handle === false) {
            throw new \InvalidArgumentException('Unable to read CSV file.');
        }
        try {
            $rows = [];
            while (($row = fgetcsv($handle, 0, ',', '"', '')) !== false) {
                if ($row === [null] || $row === false) {
                    continue;
                }
                $rows[] = $row;
            }

            return self::stripBom($rows);
        } finally {
            fclose($handle);
        }
    }

    /**
     * @return list<list<mixed>>
     */
    private static function loadXlsx(string $path): array
    {
        $reader = new XlsxReader;
        $reader->open($path);
        try {
            foreach ($reader->getSheetIterator() as $sheet) {
                $name = strtolower($sheet->getName());
                if (in_array($name, ['instructions', 'clockify mapping'], true)) {
                    continue;
                }
                $rows = [];
                foreach ($sheet->getRowIterator() as $row) {
                    $rows[] = array_map(fn ($v) => $v instanceof \DateTimeInterface ? $v->format('Y-m-d') : $v, $row->toArray());
                }
                if ($rows !== []) {
                    return $rows;
                }
            }

            return [];
        } finally {
            $reader->close();
        }
    }

    /**
     * @param  list<list<mixed>>  $rows
     * @return list<list<mixed>>
     */
    private static function stripBom(array $rows): array
    {
        if ($rows === [] || $rows[0] === []) {
            return $rows;
        }
        $first = (string) ($rows[0][0] ?? '');
        $rows[0][0] = preg_replace('/^\xEF\xBB\xBF/', '', $first) ?? $first;

        return $rows;
    }
}
