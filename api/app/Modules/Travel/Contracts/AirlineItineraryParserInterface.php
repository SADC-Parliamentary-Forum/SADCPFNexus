<?php

namespace App\Modules\Travel\Contracts;

interface AirlineItineraryParserInterface
{
    /**
     * Parse raw airline itinerary text into structured legs.
     * Stub implementations return an empty array (no paid external APIs).
     *
     * @return array<int, array<string, mixed>>
     */
    public function parse(string $rawItineraryText): array;
}
