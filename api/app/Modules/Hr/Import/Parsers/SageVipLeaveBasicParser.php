<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipLeaveBasicParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{employee_code: string, display_name: string, leave_code: string, entitlement: float, balance_bf: float, accrued: float, taken: float, balance_cf: float}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return list<array{employee_code: string, display_name: string, leave_code: string, entitlement: float, balance_bf: float, accrued: float, taken: float, balance_cf: float}>
     */
    public function parseText(string $text): array
    {
        $rows = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            if (! preg_match(
                '/^(SRHR\d+|\d{4}-\d{3})\s+(.+?)\s+([A-Z0-9_]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/',
                trim($line),
                $m
            )) {
                continue;
            }
            $rows[] = [
                'employee_code' => $m[1],
                'display_name' => trim($m[2]),
                'leave_code' => $m[3],
                'entitlement' => (float) $m[4],
                'balance_bf' => (float) $m[5],
                'accrued' => (float) $m[6],
                'taken' => (float) $m[7],
                'balance_cf' => (float) $m[8],
            ];
        }

        return $rows;
    }
}
