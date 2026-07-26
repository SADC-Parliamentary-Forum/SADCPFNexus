<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use Carbon\Carbon;

/**
 * Practical local parser for pasted confirmations, ICS, and structured lines.
 * No paid GDS / airline vendor APIs.
 */
class PracticalAirlineItineraryParser implements AirlineItineraryParserInterface
{
    public function parse(string $rawItineraryText): array
    {
        $raw = trim($rawItineraryText);
        if ($raw === '') {
            return [];
        }

        if (stripos($raw, 'BEGIN:VEVENT') !== false || stripos($raw, 'BEGIN:VCALENDAR') !== false) {
            $legs = $this->parseIcs($raw);
            if ($legs !== []) {
                return $legs;
            }
        }

        $legs = $this->parseStructuredLines($raw);
        if ($legs !== []) {
            return $legs;
        }

        return $this->parseConfirmationPaste($raw);
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseStructuredLines(string $raw): array
    {
        $legs = [];
        foreach (preg_split("/\r\n|\n|\r/", $raw) as $line) {
            $line = trim($line);
            if ($line === '') {
                continue;
            }
            // Flight BA123 WDH-JNB 2026-08-10  or  BA123 WDH → JNB 2026-08-10
            if (preg_match(
                '/(?:Flight\s+)?([A-Z0-9]{2}\s?\d{1,4})\s+([A-Z]{3})\s*[-–→>]+\s*([A-Z]{3})\s+(\d{4}-\d{2}-\d{2})/i',
                $line,
                $m
            )) {
                $legs[] = $this->leg(
                    strtoupper($m[2]),
                    strtoupper($m[3]),
                    $m[4],
                    strtoupper(str_replace(' ', '', $m[1])),
                    'structured'
                );
            }
        }

        return $legs;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseIcs(string $raw): array
    {
        $legs = [];
        if (! preg_match_all('/BEGIN:VEVENT(.*?)END:VEVENT/is', $raw, $events, PREG_SET_ORDER)) {
            return [];
        }

        foreach ($events as $event) {
            $block = $event[1];
            $summary = $this->icsField($block, 'SUMMARY') ?? '';
            $location = $this->icsField($block, 'LOCATION') ?? '';
            $dtStart = $this->icsField($block, 'DTSTART') ?? '';
            $description = $this->icsField($block, 'DESCRIPTION') ?? '';

            $from = null;
            $to = null;
            $flight = null;

            if (preg_match('/\b([A-Z]{3})\s*(?:to|-|→)\s*([A-Z]{3})\b/i', $summary.' '.$description, $m)) {
                $from = strtoupper($m[1]);
                $to = strtoupper($m[2]);
            } elseif (preg_match('/\b([A-Z]{3})\b/', $location, $m)) {
                $from = strtoupper($m[1]);
                if (preg_match('/\b([A-Z]{3})\b/', $description, $m2) && strtoupper($m2[1]) !== $from) {
                    $to = strtoupper($m2[1]);
                }
            }

            if (preg_match('/\b([A-Z]{2}\s?\d{1,4})\b/i', $summary.' '.$description, $fm)) {
                $flight = strtoupper(str_replace(' ', '', $fm[1]));
            }

            $date = $this->icsDate($dtStart);
            if ($from && $to && $date) {
                $legs[] = $this->leg($from, $to, $date, $flight, 'ics', $dtStart);
            }
        }

        return $legs;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function parseConfirmationPaste(string $raw): array
    {
        $legs = [];
        // e.g. "Confirmation: SA 456 CPT-JNB Departing 10 Aug 2026"
        if (preg_match_all(
            '/([A-Z]{2}\s?\d{1,4}).{0,40}?([A-Z]{3})\s*[-–→>\/]\s*([A-Z]{3}).{0,40}?(\d{4}-\d{2}-\d{2}|\d{1,2}\s+[A-Za-z]{3,9}\s+\d{4})/i',
            $raw,
            $matches,
            PREG_SET_ORDER
        )) {
            foreach ($matches as $m) {
                $date = $this->flexibleDate($m[4]);
                if (! $date) {
                    continue;
                }
                $legs[] = $this->leg(
                    strtoupper($m[2]),
                    strtoupper($m[3]),
                    $date,
                    strtoupper(str_replace(' ', '', $m[1])),
                    'paste'
                );
            }
        }

        return $legs;
    }

    private function icsField(string $block, string $name): ?string
    {
        if (preg_match('/'.$name.'(?:;[^:]*)?:([^\r\n]+)/i', $block, $m)) {
            return trim($m[1]);
        }

        return null;
    }

    private function icsDate(string $dtStart): ?string
    {
        if ($dtStart === '') {
            return null;
        }
        try {
            // DTSTART:20260810T080000Z or DTSTART;VALUE=DATE:20260810
            if (preg_match('/(\d{8})(?:T(\d{6}))?/', $dtStart, $m)) {
                $date = substr($m[1], 0, 4).'-'.substr($m[1], 4, 2).'-'.substr($m[1], 6, 2);

                return Carbon::parse($date)->toDateString();
            }

            return Carbon::parse($dtStart)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function flexibleDate(string $value): ?string
    {
        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    /**
     * @return array<string, mixed>
     */
    private function leg(
        string $from,
        string $to,
        string $date,
        ?string $flight,
        string $source,
        ?string $departureRaw = null,
    ): array {
        $departureAt = null;
        if ($departureRaw && preg_match('/(\d{8})T(\d{6})/', $departureRaw, $m)) {
            try {
                $departureAt = Carbon::createFromFormat('Ymd His', $m[1].' '.substr($m[2], 0, 2).' '.substr($m[2], 2, 2).' '.substr($m[2], 4, 2))
                    ->toIso8601String();
            } catch (\Throwable) {
                $departureAt = null;
            }
        }

        return [
            'from_location' => $from,
            'to_location' => $to,
            'travel_date' => $date,
            'transport_mode' => 'flight',
            'flight_number' => $flight,
            'carrier' => $flight ? substr($flight, 0, 2) : null,
            'departure_at' => $departureAt,
            'arrival_at' => null,
            'parse_source' => $source,
            'days_count' => 1,
            'day_type' => 'official',
        ];
    }
}
