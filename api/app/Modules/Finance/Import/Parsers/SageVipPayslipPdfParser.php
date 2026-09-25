<?php

namespace App\Modules\Finance\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipPayslipPdfParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{employee_code: string, employee_name: string, period_end: string, id_number: string|null, earnings: list<array{code: string, amount: float}>, deductions: list<array{code: string, amount: float}>, net_pay: float|null, gross_pay: float|null}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return list<array{employee_code: string, employee_name: string, period_end: string, id_number: string|null, earnings: list<array{code: string, amount: float}>, deductions: list<array{code: string, amount: float}>, net_pay: float|null, gross_pay: float|null}>
     */
    public function parseText(string $text): array
    {
        $parts = preg_split('/(?=Emp\. Code\s+)/i', $text) ?: [];
        $byCode = [];

        foreach ($parts as $block) {
            $parsed = $this->parseBlock($block);
            if ($parsed === null) {
                continue;
            }
            $code = $parsed['employee_code'];
            $existing = $byCode[$code] ?? null;
            if ($existing === null || $this->score($parsed) > $this->score($existing)) {
                $byCode[$code] = $parsed;
            }
        }

        return array_values($byCode);
    }

    /**
     * @return array{employee_code: string, employee_name: string, period_end: string, id_number: string|null, earnings: list<array{code: string, amount: float}>, deductions: list<array{code: string, amount: float}>, net_pay: float|null, gross_pay: float|null}|null
     */
    private function parseBlock(string $block): ?array
    {
        if (! preg_match('/Emp\. Code\s+(SRHR\d+|\d{4}-\d{3})/i', $block, $codeMatch)) {
            return null;
        }
        $code = $codeMatch[1];

        $name = '';
        if (preg_match('/Emp\. Name\s+(.+?)\s{2,}Job Title/i', $block, $nm)) {
            $name = trim($nm[1]);
        }
        $periodEnd = '2026-09-30';
        if (preg_match('/Pay Period\s+(\d{4}\/\d{2}\/\d{2})/i', $block, $pe)) {
            $periodEnd = str_replace('/', '-', $pe[1]);
        }
        $idNumber = null;
        if (preg_match('/ID Number\s+(\d+)/i', $block, $id)) {
            $idNumber = $id[1];
        }

        $gross = null;
        $net = null;
        if (preg_match('/Total Earnings\s+([\d,]+\.\d{2})/i', $block, $g)) {
            $gross = (float) str_replace(',', '', $g[1]);
        }
        if (preg_match('/Net Pay\s+([\d,]+\.\d{2})/i', $block, $n)) {
            $net = (float) str_replace(',', '', $n[1]);
        }

        $earnings = [];
        $deductions = [];
        $inDeductions = false;
        foreach (preg_split('/\R/', $block) as $line) {
            if (preg_match('/^\s*Deductions\s*$/i', trim($line))) {
                $inDeductions = true;
                continue;
            }
            if (preg_match('/^([A-Za-z0-9][A-Za-z0-9 \-]{2,40})\s+([\d,]+\.\d{2})\s{2,}([A-Za-z].+?)\s+([\d,]+\.\d{2})\s*$/', $line, $pair)) {
                $earnings[] = ['code' => trim($pair[1]), 'amount' => (float) str_replace(',', '', $pair[2])];
                $deductions[] = ['code' => trim($pair[3]), 'amount' => (float) str_replace(',', '', $pair[4])];
                continue;
            }
            if (preg_match('/^([A-Za-z].+?)\s+([\d,]+\.\d{2})\s*$/', trim($line), $single)) {
                $label = trim($single[1]);
                if (str_starts_with($label, 'Total')) {
                    continue;
                }
                $amount = (float) str_replace(',', '', $single[2]);
                if ($inDeductions || str_contains(strtolower($label), 'paye') || str_contains(strtolower($label), 'deduction')) {
                    $deductions[] = ['code' => $label, 'amount' => $amount];
                } else {
                    $earnings[] = ['code' => $label, 'amount' => $amount];
                }
            }
        }

        return [
            'employee_code' => $code,
            'employee_name' => $name,
            'period_end' => $periodEnd,
            'id_number' => $idNumber,
            'earnings' => $earnings,
            'deductions' => $deductions,
            'net_pay' => $net,
            'gross_pay' => $gross,
        ];
    }

    /**
     * @param  array{net_pay: float|null, gross_pay: float|null, earnings: list<mixed>, deductions: list<mixed>}  $row
     */
    private function score(array $row): int
    {
        $score = count($row['earnings']) + count($row['deductions']);
        if ($row['net_pay'] !== null) {
            $score += 100;
        }
        if ($row['gross_pay'] !== null) {
            $score += 50;
        }

        return $score;
    }
}
