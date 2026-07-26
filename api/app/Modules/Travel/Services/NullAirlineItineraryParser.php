<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;

/**
 * Null stub — airline itinerary parsing is deferred; no fake paid APIs.
 */
class NullAirlineItineraryParser implements AirlineItineraryParserInterface
{
    public function parse(string $rawItineraryText): array
    {
        return [];
    }
}
