<?php

namespace App\Modules\Travel\Contracts;

use Carbon\CarbonInterface;

interface FxRateFeedInterface
{
    /**
     * Fetch FX rate for a currency pair on a given date.
     * Prefer tenant manual table; optional HTTP provider when configured.
     * Pass $tenantId when Auth context is unavailable (e.g. queued jobs).
     */
    public function getRate(string $fromCurrency, string $toCurrency, CarbonInterface $asOf, ?int $tenantId = null): ?float;
}
