<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipLeaveHistoryParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return list<array{display_name: string, leave_type: string, start: float, adj: float, accr: float, taken: float, end: float}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return list<array{display_name: string, leave_type: string, start: float, adj: float, accr: float, taken: float, end: float}>
     */
    public function parseText(string $text): array
    {
        $rows = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            $line = trim($line);
            if ($line === '' || str_contains($line, 'Leave History')) {
                continue;
            }
            if (! preg_match(
                '/^(.+?)\s+([A-Z0-9_]+(?:\s+-\s+.+)?)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*$/',
                $line,
                $m
            )) {
                continue;
            }
            $rows[] = [
                'display_name' => trim($m[1]),
                'leave_type' => trim($m[2]),
                'start' => (float) $m[3],
                'adj' => (float) $m[4],
                'accr' => (float) $m[5],
                'taken' => (float) $m[6],
                'end' => (float) $m[7],
            ];
        }

        return $rows;
    }
}
