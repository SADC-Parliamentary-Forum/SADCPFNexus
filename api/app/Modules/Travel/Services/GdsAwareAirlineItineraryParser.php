<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use App\Modules\Travel\Contracts\GdsProviderInterface;

/**
 * Extends practical local parsing with optional env-gated GDS fetch.
 * Never uses a paid marketplace; NullGdsProvider is the default.
 */
class GdsAwareAirlineItineraryParser implements AirlineItineraryParserInterface
{
    public function __construct(
        private readonly PracticalAirlineItineraryParser $local,
        private readonly GdsProviderInterface $gds,
    ) {}

    public function parse(string $rawItineraryText): array
    {
        $legs = $this->local->parse($rawItineraryText);
        if ($legs !== []) {
            return $legs;
        }

        $ref = trim($rawItineraryText);
        if (! $this->gds->isEnabled() || ! $this->looksLikeBookingRef($ref)) {
            return [];
        }

        $payload = $this->gds->fetchItinerary($ref);
        if (! $payload) {
            return [];
        }

        if (! empty($payload['legs']) && is_array($payload['legs'])) {
            return array_values($payload['legs']);
        }

        if (! empty($payload['raw_text']) && is_string($payload['raw_text'])) {
            return $this->local->parse($payload['raw_text']);
        }

        return [];
    }

    private function looksLikeBookingRef(string $raw): bool
    {
        // Short alphanumeric PNR-like token without newlines.
        return (bool) preg_match('/^[A-Z0-9]{5,8}$/i', $raw);
    }
}
