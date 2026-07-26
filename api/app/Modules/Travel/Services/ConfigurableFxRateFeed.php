<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelFxRate;
use App\Modules\Travel\Contracts\FxRateFeedInterface;
use App\Modules\Travel\Contracts\HttpFxRateProviderInterface;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Auth;

/**
 * Prefer tenant manual/admin FX table; optionally fall back to HTTP provider.
 */
class ConfigurableFxRateFeed implements FxRateFeedInterface
{
    public function __construct(
        private readonly HttpFxRateProviderInterface $httpProvider,
    ) {}

    public function getRate(string $fromCurrency, string $toCurrency, CarbonInterface $asOf, ?int $tenantId = null): ?float
    {
        $from = strtoupper($fromCurrency);
        $to = strtoupper($toCurrency);
        if ($from === $to) {
            return 1.0;
        }

        $tenantId = $tenantId ?? Auth::user()?->tenant_id;
        if ($tenantId) {
            $row = TravelFxRate::query()
                ->where('tenant_id', $tenantId)
                ->where('from_currency', $from)
                ->where('to_currency', $to)
                ->whereDate('effective_date', '<=', $asOf->toDateString())
                ->orderByDesc('effective_date')
                ->orderByDesc('id')
                ->first();

            if ($row) {
                return (float) $row->rate;
            }

            $inverse = TravelFxRate::query()
                ->where('tenant_id', $tenantId)
                ->where('from_currency', $to)
                ->where('to_currency', $from)
                ->whereDate('effective_date', '<=', $asOf->toDateString())
                ->orderByDesc('effective_date')
                ->orderByDesc('id')
                ->first();

            if ($inverse && (float) $inverse->rate > 0) {
                return 1 / (float) $inverse->rate;
            }
        }

        return $this->httpProvider->fetchRate($from, $to, $asOf);
    }
}
