<?php

namespace App\Modules\Travel\Contracts;

use Carbon\CarbonInterface;

interface FxRateFeedInterface
{
    /**
     * Fetch FX rate for a currency pair on a given date.
     * Stub implementations return null (no paid external APIs).
     */
    public function getRate(string $fromCurrency, string $toCurrency, CarbonInterface $asOf): ?float;
}
