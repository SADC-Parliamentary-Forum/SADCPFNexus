<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\FxRateFeedInterface;
use Carbon\CarbonInterface;

/**
 * Null stub — automatic FX feeds are deferred; no fake paid APIs.
 */
class NullFxRateFeed implements FxRateFeedInterface
{
    public function getRate(string $fromCurrency, string $toCurrency, CarbonInterface $asOf): ?float
    {
        return null;
    }
}
