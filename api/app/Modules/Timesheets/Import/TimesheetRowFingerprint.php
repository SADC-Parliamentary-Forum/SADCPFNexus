<?php

namespace App\Modules\Timesheets\Import;

final class TimesheetRowFingerprint
{
    /**
     * @param  array<string, mixed>  $canonical
     */
    public static function make(int $tenantId, array $canonical): string
    {
        $parts = [
            (string) $tenantId,
            (string) ($canonical['user_id'] ?? ''),
            self::normDate($canonical['work_date'] ?? null),
            self::normTime($canonical['start_time'] ?? null),
            self::normTime($canonical['end_time'] ?? null),
            self::normText($canonical['project'] ?? null),
            self::normText($canonical['activity'] ?? null),
            self::normText($canonical['description'] ?? null),
            self::normHours($canonical['hours'] ?? null),
        ];

        return hash('sha256', implode('|', $parts));
    }

    private static function normDate(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return (string) $value;
    }

    private static function normTime(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }
        $raw = trim((string) $value);
        if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?/', $raw, $m)) {
            return sprintf('%02d:%02d:%02d', (int) $m[1], (int) $m[2], (int) ($m[3] ?? 0));
        }

        return strtolower($raw);
    }

    private static function normText(mixed $value): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', (string) ($value ?? '')) ?? ''));
    }

    private static function normHours(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '';
        }

        return number_format((float) $value, 2, '.', '');
    }
}
