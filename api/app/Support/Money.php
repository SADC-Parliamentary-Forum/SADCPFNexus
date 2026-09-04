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
        $normalized = preg_replace('/[^\d.\-]/', '', str_replace(',', '', (string) $value)) ?? '0';
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
}
