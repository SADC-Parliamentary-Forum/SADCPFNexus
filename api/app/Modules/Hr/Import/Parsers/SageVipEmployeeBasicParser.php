<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipEmployeeBasicParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{employee_code: string, display_name: string, company_rule: string|null}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return list<array{employee_code: string, display_name: string, company_rule: string|null}>
     */
    public function parseText(string $text): array
    {
        $rows = [];
        $lines = preg_split('/\R/', $text) ?: [];
        $i = 0;
        while ($i < count($lines)) {
            $line = trim($lines[$i]);
            if ($line === '' || str_contains($line, 'Employee Basic') || str_contains($line, 'Employee Code')) {
                $i++;

                continue;
            }
            if (preg_match('/^(SRHR\d+|\d{4}-\d{3})$/', $line)) {
                $code = $line;
                $name = trim($lines[$i + 1] ?? '');
                $company = null;
                $j = $i + 2;
                while ($j < count($lines) && trim($lines[$j]) !== '' && ! preg_match('/^(SRHR\d+|\d{4}-\d{3})$/', trim($lines[$j]))) {
                    $chunk = trim($lines[$j]);
                    if (str_contains($chunk, 'SADC Parliamentary Forum') || str_contains($chunk, 'Contractors')) {
                        $company = $chunk;
                    }
                    $j++;
                }
                if ($name !== '') {
                    $rows[] = [
                        'employee_code' => $code,
                        'display_name' => $name,
                        'company_rule' => $company,
                    ];
                }
                $i = $j;

                continue;
            }
            if (preg_match('/^(SRHR\d+|\d{4}-\d{3})\s+(.+)$/', $line, $m)) {
                $rows[] = [
                    'employee_code' => $m[1],
                    'display_name' => trim($m[2]),
                    'company_rule' => null,
                ];
            }
            $i++;
        }

        return $rows;
    }
}
