<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;

final class SageVipEmployeeReconParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return array<string, array{active: bool, terminated: bool, old_termination: bool}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return array<string, array{active: bool, terminated: bool, old_termination: bool}>
     */
    public function parseText(string $text): array
    {
        $map = [];
        foreach (preg_split('/\R/', $text) ?: [] as $line) {
            if (! preg_match('/^(SRHR\d+|\d{4}-\d{3})\s+(.+)$/', trim($line), $m)) {
                continue;
            }
            $rest = $m[2];
            $map[$m[1]] = [
                'active' => (bool) preg_match('/\bActive\b/i', $rest),
                'terminated' => (bool) preg_match('/\bTerminated\b/i', $rest),
                'old_termination' => (bool) preg_match('/Old\s*Term/i', $rest),
            ];
        }

        return $map;
    }
}
