<?php

namespace App\Modules\Travel\Contracts;

use Carbon\CarbonInterface;

/**
 * Optional HTTP FX provider. Implementations must not embed paid API keys;
 * credentials come from env/config only.
 */
interface HttpFxRateProviderInterface
{
    public function fetchRate(string $fromCurrency, string $toCurrency, CarbonInterface $asOf): ?float;
}
