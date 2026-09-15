<?php

namespace App\Modules\Timesheets\Import;

final class TimesheetHeaderIndex
{
    /**
     * @param  list<string>  $headers
     * @return array<string, int>
     */
    public static function index(array $headers): array
    {
        $out = [];
        foreach ($headers as $i => $header) {
            $key = TimesheetFormatDetector::norm($header);
            if ($key !== '' && ! isset($out[$key])) {
                $out[$key] = $i;
            }
        }

        return $out;
    }

    /**
     * @param  array<string, int>  $index
     * @param  list<mixed>  $values
     * @param  list<string>  $aliases
     */
    public static function value(array $index, array $values, array $aliases): mixed
    {
        foreach ($aliases as $alias) {
            $key = TimesheetFormatDetector::norm($alias);
            if (isset($index[$key]) && array_key_exists($index[$key], $values)) {
                $value = $values[$index[$key]];
                if ($value !== null && $value !== '') {
                    return $value;
                }
            }
        }

        return null;
    }
}
