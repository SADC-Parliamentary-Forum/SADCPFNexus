<?php

namespace App\Support;

use Carbon\Carbon;
use DateTimeInterface;
use Stringable;

/**
 * Canonical human dates for mail, PDFs, and other server-rendered UI.
 * Matches web formatDateShort: "21 Aug 2026" (en-GB, not US 08/21/2026).
 */
final class DateFormat
{
    public const DATE = 'd M Y';

    public const DATETIME = 'd M Y, H:i';

    public static function date(mixed $value): string
    {
        $parsed = self::parse($value);
        if (! $parsed) {
            return '—';
        }

        return $parsed->format(self::DATE);
    }

    public static function datetime(mixed $value): string
    {
        $parsed = self::parse($value);
        if (! $parsed) {
            return '—';
        }

        return $parsed->timezone('UTC')->format(self::DATETIME);
    }

    /**
     * Template interpolation: format date-like values, leave other strings alone.
     */
    public static function display(mixed $value): string
    {
        if ($value === null || $value === '') {
            return '—';
        }

        if ($value instanceof DateTimeInterface) {
            return self::fromParsed(Carbon::parse($value));
        }

        if ($value instanceof Stringable) {
            $value = (string) $value;
        }

        if (! is_string($value)) {
            return (string) $value;
        }

        $string = trim($value);
        if ($string === '') {
            return '—';
        }

        if (! self::looksLikeDate($string)) {
            return $string;
        }

        $parsed = self::parse($string);

        return $parsed ? self::fromParsed($parsed) : $string;
    }

    private static function fromParsed(Carbon $parsed): string
    {
        if (self::isMidnight($parsed)) {
            return $parsed->format(self::DATE);
        }

        return $parsed->timezone('UTC')->format(self::DATETIME);
    }

    private static function isMidnight(Carbon $dt): bool
    {
        return $dt->hour === 0 && $dt->minute === 0 && $dt->second === 0;
    }

    private static function looksLikeDate(string $value): bool
    {
        return (bool) preg_match(
            '/^\d{4}-\d{2}-\d{2}(?:[T ][\d:.]+(?:Z|[+\-]\d{2}:?\d{2})?)?$/',
            $value
        );
    }

    private static function parse(mixed $value): ?Carbon
    {
        if ($value instanceof Carbon) {
            return $value->copy();
        }

        if ($value instanceof DateTimeInterface) {
            return Carbon::instance($value);
        }

        if (! is_string($value) && ! is_numeric($value)) {
            return null;
        }

        $string = trim((string) $value);
        if ($string === '' || $string === '—') {
            return null;
        }

        try {
            if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $string, $m)) {
                return Carbon::create((int) $m[1], (int) $m[2], (int) $m[3], 0, 0, 0, 'UTC');
            }

            return Carbon::parse($string);
        } catch (\Throwable) {
            return null;
        }
    }
}
