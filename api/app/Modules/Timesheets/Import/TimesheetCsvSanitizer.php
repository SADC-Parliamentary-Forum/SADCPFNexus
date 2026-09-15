<?php

namespace App\Modules\Timesheets\Import;

final class TimesheetCsvSanitizer
{
    public static function cell(mixed $value): string
    {
        $text = (string) $value;
        if ($text !== '' && in_array($text[0], ['=', '+', '-', '@'], true)) {
            return "'".$text;
        }

        return $text;
    }
}
