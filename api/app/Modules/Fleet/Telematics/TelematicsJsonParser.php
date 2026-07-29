<?php

namespace App\Modules\Fleet\Telematics;

/**
 * Parse vendor-agnostic position JSON into TelematicsPosition list.
 */
final class TelematicsJsonParser
{
    /**
     * @param  mixed  $payload
     * @return list<TelematicsPosition>
     */
    public static function parse(mixed $payload): array
    {
        if (! is_array($payload)) {
            return [];
        }

        $rows = $payload;
        if (isset($payload['positions']) && is_array($payload['positions'])) {
            $rows = $payload['positions'];
        } elseif (isset($payload['data']) && is_array($payload['data'])) {
            $rows = $payload['data'];
        }

        // Single position object
        if (isset($rows['device_id']) || isset($rows['lat']) || isset($rows['latitude'])) {
            $rows = [$rows];
        }

        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $pos = TelematicsPosition::fromArray($row);
            if ($pos !== null) {
                $out[] = $pos;
            }
        }

        return $out;
    }
}
