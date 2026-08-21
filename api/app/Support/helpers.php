<?php

use App\Support\DateFormat;

if (! function_exists('human_date')) {
    /**
     * Calendar date for humans: 21 Aug 2026. Date-only values never show midnight.
     */
    function human_date(mixed $value): string
    {
        return DateFormat::date($value);
    }
}

if (! function_exists('human_datetime')) {
    /**
     * Timestamp for humans: 21 Aug 2026, 10:00 (UTC).
     */
    function human_datetime(mixed $value): string
    {
        return DateFormat::datetime($value);
    }
}
