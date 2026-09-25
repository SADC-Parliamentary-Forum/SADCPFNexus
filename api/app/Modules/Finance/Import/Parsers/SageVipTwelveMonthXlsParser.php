<?php

namespace App\Modules\Finance\Import\Parsers;

use PhpOffice\PhpSpreadsheet\IOFactory;

final class SageVipTwelveMonthXlsParser
{
    /**
     * @return list<array{employee_code: string|null, display_name: string, lines: list<array{defcode: string, sep_2026: float|null, total: float|null}>}>
     */
    public function parseFile(string $path): array
    {
        $spreadsheet = IOFactory::load($path);
        $sheet = $spreadsheet->getActiveSheet();
        $rows = [];
        $current = null;

        foreach ($sheet->getRowIterator() as $row) {
            $cells = [];
            foreach ($row->getCellIterator() as $cell) {
                $cells[] = trim((string) $cell->getFormattedValue());
            }
            $joined = trim(implode(' ', array_filter($cells)));
            if ($joined === '') {
                continue;
            }

            if (preg_match('/^(SRHR\d+|\d{4}-\d{3})\s*-\s*(.+)$/', $joined, $m)) {
                if ($current !== null) {
                    $rows[] = $current;
                }
                $current = [
                    'employee_code' => $m[1],
                    'display_name' => trim($m[2]),
                    'lines' => [],
                ];

                continue;
            }

            if ($current === null) {
                continue;
            }

            $def = $cells[0] ?? '';
            if ($def === '' || str_contains($def, 'Employee')) {
                continue;
            }
            $sep = isset($cells[1]) && $cells[1] !== '' ? (float) str_replace(',', '', $cells[1]) : null;
            $total = isset($cells[2]) && $cells[2] !== '' ? (float) str_replace(',', '', $cells[2]) : null;
            $current['lines'][] = [
                'defcode' => $def,
                'sep_2026' => $sep,
                'total' => $total,
            ];
        }

        if ($current !== null) {
            $rows[] = $current;
        }

        return $rows;
    }
}
