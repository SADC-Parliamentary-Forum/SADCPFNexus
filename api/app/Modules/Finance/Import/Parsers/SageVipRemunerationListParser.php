<?php

namespace App\Modules\Finance\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipRemunerationListParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{employee_code: string, display_name: string, net_pay: float, currency: string, pay_method: string|null}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return list<array{employee_code: string, display_name: string, net_pay: float, currency: string, pay_method: string|null}>
     */
    public function parseText(string $text): array
    {
        $rows = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            if (! preg_match(
                '/^(SRHR\d+|\d{4}-\d{3})\s+(.+?)\s+([\d,]+\.\d{2})\s+(NAD|[A-Z]{3})\s+(.+)?$/',
                trim($line),
                $m
            )) {
                continue;
            }
            $rows[] = [
                'employee_code' => $m[1],
                'display_name' => trim($m[2]),
                'net_pay' => (float) str_replace(',', '', $m[3]),
                'currency' => $m[4],
                'pay_method' => isset($m[5]) ? trim($m[5]) : null,
            ];
        }

        return $rows;
    }
}
