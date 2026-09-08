<?php

namespace App\Support;

/**
 * JSON-safe UTF-8 cleaning. Laravel's json cast throws on malformed bytes.
 */
final class Utf8
{
    public static function string(mixed $value): string
    {
        if (! is_string($value) || $value === '') {
            return is_string($value) ? $value : '';
        }
        if (mb_check_encoding($value, 'UTF-8')) {
            return $value;
        }
        $clean = @iconv('UTF-8', 'UTF-8//IGNORE', $value);

        return $clean === false ? '' : $clean;
    }

    public static function sanitize(mixed $value): mixed
    {
        if (is_string($value)) {
            return self::string($value);
        }
        if (is_array($value)) {
            $out = [];
            foreach ($value as $k => $v) {
                $out[is_string($k) ? self::string($k) : $k] = self::sanitize($v);
            }

            return $out;
        }

        return $value;
    }
}
