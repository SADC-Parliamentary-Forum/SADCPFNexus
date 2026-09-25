<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;
use Carbon\Carbon;

final class SageVipLeaveDetailParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{employee_code: string, display_name: string, from_date: string, to_date: string, leave_type: string, taken_days: float, reason: string|null, ref_no: string|null}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return list<array{employee_code: string, display_name: string, from_date: string, to_date: string, leave_type: string, taken_days: float, reason: string|null, ref_no: string|null}>
     */
    public function parseText(string $text): array
    {
        $lines = preg_split('/\R/', $text) ?: [];
        $rows = [];
        $n = count($lines);

        for ($i = 0; $i < $n - 2; $i++) {
            $l1 = $lines[$i];
            $l2 = $lines[$i + 1];
            $l3 = $lines[$i + 2];

            if (! preg_match('/(\d{2} \w{3})\s+(\d{2} \w{3})\s+(.+)/', $l1, $dateMatch)) {
                continue;
            }
            if (! preg_match('/^(SRHR\d+|\d{4}-\d{3})\s+(.+?)\s+([\d.]+)/', trim($l2), $empMatch)) {
                continue;
            }
            if (! preg_match('/(\d{4})\s+(\d{4})/', $l3, $yearMatch)) {
                continue;
            }

            try {
                $from = Carbon::parse($dateMatch[1].' '.$yearMatch[1])->toDateString();
                $to = Carbon::parse($dateMatch[2].' '.$yearMatch[2])->toDateString();
            } catch (\Throwable) {
                continue;
            }

            $type = trim(preg_replace('/\s+E\d{6}-T\d{4}-.*/', '', $dateMatch[3]) ?? $dateMatch[3]);
            $reason = null;
            $ref = null;
            if (preg_match('/E(\d{6}-T\d{4}-N\d+)/', $l1.' '.$l2.' '.$l3, $refMatch)) {
                $ref = $refMatch[1];
            }
            if (preg_match('/\s{2,}(.{3,80})$/', $l2, $reasonMatch)) {
                $candidate = trim($reasonMatch[1]);
                if (! preg_match('/^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)$/i', $candidate)) {
                    $reason = $candidate;
                }
            }

            $rows[] = [
                'employee_code' => $empMatch[1],
                'display_name' => trim($empMatch[2]),
                'from_date' => $from,
                'to_date' => $to,
                'leave_type' => $type,
                'taken_days' => (float) $empMatch[3],
                'reason' => $reason,
                'ref_no' => $ref,
            ];
            $i += 2;
        }

        return $rows;
    }
}
