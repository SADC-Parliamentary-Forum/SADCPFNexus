<?php

namespace App\Modules\Travel\Contracts;

/**
 * Pluggable GDS adapter — itinerary fetch/parse hints only.
 * No paid marketplace; credentials via env only.
 */
interface GdsProviderInterface
{
    public function name(): string;

    public function isEnabled(): bool;

    /**
     * Optional raw itinerary text or structured payload for a PNR / booking ref.
     * Null adapters return null.
     *
     * @return array{raw_text?: string, legs?: list<array<string, mixed>>}|null
     */
    public function fetchItinerary(string $bookingReference): ?array;

    /**
     * Offer search only. Never books, pays, or checks out.
     *
     * @return list<array<string, mixed>>
     */
    public function searchOffers(array $criteria = []): array;
}
