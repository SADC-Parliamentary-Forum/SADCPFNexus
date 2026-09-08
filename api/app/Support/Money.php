<?php

namespace App\Support;

/**
 * Decimal-safe money helpers using integer cents. Never use binary floats for equality.
 */
final class Money
{
    public static function toCents(string|int|float|null $value): int
    {
        if ($value === null || $value === '') {
            return 0;
        }
        $normalized = self::normalizeDecimal((string) $value);
        if ($normalized === '' || $normalized === '-' || $normalized === '.') {
            return 0;
        }
        if (function_exists('bcmul')) {
            return (int) bcmul($normalized, '100', 0);
        }

        [$whole, $frac] = array_pad(explode('.', $normalized, 2), 2, '00');
        $frac = substr(str_pad($frac, 2, '0'), 0, 2);
        $sign = str_starts_with($whole, '-') ? -1 : 1;
        $whole = ltrim($whole, '+-');

        return $sign * (((int) $whole) * 100 + (int) $frac);
    }

    public static function fromCents(int $cents): string
    {
        $sign = $cents < 0 ? '-' : '';
        $abs = abs($cents);

        return $sign.sprintf('%d.%02d', intdiv($abs, 100), $abs % 100);
    }

    public static function equals(string|int|float|null $a, string|int|float|null $b): bool
    {
        return self::toCents($a) === self::toCents($b);
    }

    /**
     * US 4,499.69 keeps the period as decimal. NAD/Wave $4 499,69 uses a comma decimal.
     */
    private static function normalizeDecimal(string $value): string
    {
        $s = preg_replace('/[^\d,.\-\s]/', '', $value) ?? '0';
        $s = trim($s);
        if ($s === '' || $s === '-' || $s === '.' || $s === ',') {
            return '0';
        }
        if (preg_match('/,\d{1,2}$/', $s) && ! preg_match('/\.\d{1,2}$/', $s)) {
            $s = str_replace([' ', "\u{00A0}", '.'], '', $s);

            return str_replace(',', '.', $s);
        }

        return preg_replace('/[^\d.\-]/', '', str_replace(',', '', $s)) ?? '0';
    }
}
