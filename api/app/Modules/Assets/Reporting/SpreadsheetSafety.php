<?php

namespace App\Modules\Assets\Reporting;

final class SpreadsheetSafety
{
    public static function formulaSafe(?string $value): string
    {
        $value = (string) $value;
        if ($value !== '' && preg_match('/^[=+\-@\t\r]/', $value)) {
            return "'".$value;
        }

        return $value;
    }

    public static function filename(string $reportName, string $scope, string $reportRunId, string $ext): string
    {
        $safe = static fn (string $part) => preg_replace('/[^A-Za-z0-9]+/', '_', $part) ?: 'Report';

        return sprintf(
            'SADC_PF_%s_%s_%s_%s.%s',
            $safe($reportName),
            $safe($scope),
            now()->format('Y-m-d'),
            $safe($reportRunId),
            $ext,
        );
    }
}
