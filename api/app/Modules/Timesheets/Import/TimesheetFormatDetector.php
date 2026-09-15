<?php

namespace App\Modules\Timesheets\Import;

final class TimesheetFormatDetector
{
    public const FORMAT_NEXUS = 'nexus_template';

    public const FORMAT_CLOCKIFY = 'clockify_detailed';

    public const FORMAT_CUSTOM = 'custom';

    /**
     * @param  list<string>  $headers
     * @return array{format: string, score: int, recognised: int, total: int, unmapped: list<string>}
     */
    public static function detect(array $headers): array
    {
        $normalised = array_map([self::class, 'norm'], $headers);
        $clockify = self::clockifyHeaders();
        $nexus = self::nexusHeaders();

        $clockifyHits = self::hits($normalised, $clockify);
        $nexusHits = self::hits($normalised, $nexus);

        $format = self::FORMAT_CUSTOM;
        $score = max($clockifyHits, $nexusHits);
        if ($clockifyHits >= 6 && $clockifyHits >= $nexusHits) {
            $format = self::FORMAT_CLOCKIFY;
            $score = $clockifyHits;
        } elseif ($nexusHits >= 5) {
            $format = self::FORMAT_NEXUS;
            $score = $nexusHits;
        }

        $known = array_unique(array_merge($clockify, $nexus));
        $unmapped = [];
        foreach ($normalised as $header) {
            if ($header !== '' && ! in_array($header, $known, true)) {
                $unmapped[] = $header;
            }
        }

        return [
            'format' => $format,
            'score' => $score,
            'recognised' => $score,
            'total' => count(array_filter($normalised)),
            'unmapped' => array_values($unmapped),
        ];
    }

    /**
     * @return list<string>
     */
    public static function clockifyHeaders(): array
    {
        return [
            'project', 'department', 'description', 'activity', 'task', 'user', 'group',
            'email', 'tags', 'start date', 'start time', 'end date', 'end time',
            'duration (h)', 'duration (decimal)', 'billable', 'billable rate', 'billable amount',
            'date of creation',
        ];
    }

    /**
     * @return list<string>
     */
    public static function nexusHeaders(): array
    {
        return NexusTimesheetTemplateWorkbook::HEADERS;
    }

    /**
     * @param  list<string>  $headers
     * @param  list<string>  $known
     */
    private static function hits(array $headers, array $known): int
    {
        $count = 0;
        foreach ($headers as $header) {
            if (in_array($header, $known, true)) {
                $count++;
            }
        }

        return $count;
    }

    public static function norm(mixed $header): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/', ' ', (string) $header) ?? ''));
    }
}
