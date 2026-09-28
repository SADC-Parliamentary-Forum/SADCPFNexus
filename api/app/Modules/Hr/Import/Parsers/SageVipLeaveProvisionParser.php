<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipLeaveProvisionParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{employee_code: string, display_name: string, entitlement: float, balance_bf: float, accrued: float, taken: float, leave_movement: float, termination_payout_rate: float, termination_payout: float, normal_payout_rate: float, normal_payout: float, balance_cf: float}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * Report columns: Entitlement, Balance B/F, Accrued This Period, Taken This Period,
     * Leave Movement, Termination Payout Rate, Termination Payout, Normal Payout Rate,
     * Normal Payout, Balance C/F — 10 numeric fields, several of which are legitimately
     * negative (e.g. Leave Movement, Termination Payout) and some carry thousands
     * separators (e.g. "4,223.47"). Both must be tolerated or the whole report fails to
     * parse and every row is silently dropped.
     *
     * @return list<array{employee_code: string, display_name: string, entitlement: float, balance_bf: float, accrued: float, taken: float, leave_movement: float, termination_payout_rate: float, termination_payout: float, normal_payout_rate: float, normal_payout: float, balance_cf: float}>
     */
    public function parseText(string $text): array
    {
        $num = '(-?[\d,]+(?:\.\d+)?)';
        $rows = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            if (! preg_match(
                '/^(SRHR\d+|\d{4}-\d{3})\s+(.+?)\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s+'.$num.'\s*$/',
                trim($line),
                $m
            )) {
                continue;
            }
            $rows[] = [
                'employee_code' => $m[1],
                'display_name' => trim($m[2]),
                'entitlement' => $this->num($m[3]),
                'balance_bf' => $this->num($m[4]),
                'accrued' => $this->num($m[5]),
                'taken' => $this->num($m[6]),
                'leave_movement' => $this->num($m[7]),
                'termination_payout_rate' => $this->num($m[8]),
                'termination_payout' => $this->num($m[9]),
                'normal_payout_rate' => $this->num($m[10]),
                'normal_payout' => $this->num($m[11]),
                'balance_cf' => $this->num($m[12]),
            ];
        }

        return $rows;
    }

    private function num(string $value): float
    {
        return (float) str_replace(',', '', $value);
    }
}
