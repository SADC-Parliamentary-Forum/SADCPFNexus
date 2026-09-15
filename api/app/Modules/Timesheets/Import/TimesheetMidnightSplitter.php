<?php

namespace App\Modules\Timesheets\Import;

use Carbon\Carbon;

final class TimesheetMidnightSplitter
{
    /**
     * Split a source row that spans calendar days into per-day slices.
     *
     * @param  array<string, mixed>  $row
     * @return list<array<string, mixed>>
     */
    public static function split(array $row): array
    {
        $startDate = self::date($row['start_date'] ?? $row['work_date'] ?? null);
        $endDate = self::date($row['end_date'] ?? $row['start_date'] ?? $row['work_date'] ?? null);
        $startTime = self::time($row['start_time'] ?? null) ?? '00:00:00';
        $endTime = self::time($row['end_time'] ?? null);

        if ($startDate === null) {
            return [$row];
        }

        if ($endDate === null || $endDate === $startDate) {
            $copy = $row;
            $copy['work_date'] = $startDate;
            $copy['start_date'] = $startDate;
            $copy['end_date'] = $startDate;

            return [$copy];
        }

        if ($endTime === null) {
            $copy = $row;
            $copy['multi_day_ambiguous'] = true;
            $copy['work_date'] = $startDate;

            return [$copy];
        }

        $cursor = Carbon::parse($startDate.' '.$startTime);
        $end = Carbon::parse($endDate.' '.$endTime);
        if ($end->lte($cursor)) {
            $copy = $row;
            $copy['invalid_range'] = true;
            $copy['work_date'] = $startDate;

            return [$copy];
        }

        $totalHours = $cursor->diffInSeconds($end) / 3600;
        if ($totalHours > 24 && $cursor->diffInDays($end) > 1 && ($row['hours'] ?? null) === null) {
            // still split; validator will flag >24 slices
        }

        $slices = [];
        $index = 0;
        while ($cursor->lt($end)) {
            $midnight = $cursor->copy()->addDay()->startOfDay();
            $dayEnd = $midnight->lt($end) ? $midnight : $end->copy();
            $hours = round($cursor->diffInSeconds($dayEnd) / 3600, 2);
            $slice = $row;
            $slice['work_date'] = $cursor->toDateString();
            $slice['start_date'] = $cursor->toDateString();
            $slice['end_date'] = $cursor->toDateString();
            $slice['start_time'] = $cursor->format('H:i:s');
            if ($dayEnd->equalTo($midnight)) {
                $slice['end_time'] = '24:00:00';
            } else {
                $slice['end_time'] = $dayEnd->format('H:i:s');
            }
            $slice['hours'] = $hours;
            $slice['split_index'] = $index;
            $slices[] = $slice;
            $cursor = $dayEnd->copy();
            $index++;
            if ($index > 14) {
                break;
            }
        }

        return $slices === [] ? [$row] : $slices;
    }

    private static function date(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        try {
            return Carbon::parse((string) $value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private static function time(mixed $value): ?string
    {
        if ($value === null || $value === '') {
            return null;
        }
        $raw = trim((string) $value);
        try {
            return Carbon::parse($raw)->format('H:i:s');
        } catch (\Throwable) {
            if (preg_match('/^(\d{1,2}):(\d{2})(?::(\d{2}))?/', $raw, $m)) {
                return sprintf('%02d:%02d:%02d', (int) $m[1], (int) $m[2], (int) ($m[3] ?? 0));
            }

            return null;
        }
    }
}
