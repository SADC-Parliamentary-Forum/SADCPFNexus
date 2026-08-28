<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\GdsProviderInterface;

class NullGdsProvider implements GdsProviderInterface
{
    public function name(): string
    {
        return 'null';
    }

    public function isEnabled(): bool
    {
        return false;
    }

    public function fetchItinerary(string $bookingReference): ?array
    {
        return null;
    }

    public function searchOffers(array $criteria = []): array
    {
        return [];
    }
}
