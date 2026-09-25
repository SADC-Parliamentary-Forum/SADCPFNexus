<?php

namespace App\Modules\Hr\Import\Parsers;

use App\Modules\Hr\Import\Support\VipPdfTextExtractor;
use Carbon\Carbon;

final class SageVipBirthdayListParser
{
    public function __construct(private readonly VipPdfTextExtractor $pdf = new VipPdfTextExtractor) {}

    /**
     * @return array<string, array{id_number: string|null, birth_date: string|null}>
     */
    public function parseFile(string $path): array
    {
        return $this->parseText($this->pdf->layoutTextFromPath($path));
    }

    /**
     * @return array<string, array{id_number: string|null, birth_date: string|null}>
     */
    public function parseText(string $text): array
    {
        $map = [];
        $lines = preg_split('/\R/', $text) ?: [];
        $i = 0;
        while ($i < count($lines)) {
            $line = trim($lines[$i]);
            if (preg_match('/^(SRHR\d+|\d{4}-\d{3})$/', $line)) {
                $code = $line;
                $name = trim($lines[$i + 1] ?? '');
                $id = null;
                $dob = null;
                for ($j = $i + 2; $j < min($i + 8, count($lines)); $j++) {
                    $chunk = trim($lines[$j]);
                    if (preg_match('/^\d{11,13}$/', $chunk)) {
                        $id = $chunk;
                    }
                    if (preg_match('/\d{1,2}\s+\w+\s+\d{4}/', $chunk, $dm)) {
                        try {
                            $dob = Carbon::parse($dm[0])->toDateString();
                        } catch (\Throwable) {
                            $dob = null;
                        }
                    }
                    if (preg_match('/^(SRHR\d+|\d{4}-\d{3})$/', $chunk)) {
                        break;
                    }
                }
                $map[$code] = [
                    'display_name' => $name,
                    'id_number' => $id,
                    'birth_date' => $dob,
                ];
            }
            if (preg_match('/^(SRHR\d+|\d{4}-\d{3})\s+(.+?)\s+(\d{11,13})\s+(\d{1,2}\s+\w+\s+\d{4})/', $line, $m)) {
                try {
                    $dob = Carbon::parse($m[4])->toDateString();
                } catch (\Throwable) {
                    $dob = null;
                }
                $map[$m[1]] = [
                    'display_name' => trim($m[2]),
                    'id_number' => $m[3],
                    'birth_date' => $dob,
                ];
            }
            $i++;
        }

        return $map;
    }
}
