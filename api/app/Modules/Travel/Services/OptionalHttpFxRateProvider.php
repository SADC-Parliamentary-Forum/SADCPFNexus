<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\HttpFxRateProviderInterface;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Optional HTTP FX fetch. Uses TRAVEL_FX_HTTP_URL (+ optional token).
 * Never hardcodes paid vendor API keys.
 */
class OptionalHttpFxRateProvider implements HttpFxRateProviderInterface
{
    public function fetchRate(string $fromCurrency, string $toCurrency, CarbonInterface $asOf): ?float
    {
        $url = config('travel.fx_http_url');
        if (! is_string($url) || trim($url) === '') {
            return null;
        }

        try {
            $headers = ['Accept' => 'application/json'];
            $token = config('travel.fx_http_token');
            if (is_string($token) && $token !== '') {
                $headers['Authorization'] = 'Bearer '.$token;
            }

            $response = Http::timeout(5)
                ->withHeaders($headers)
                ->get($url, [
                    'from' => strtoupper($fromCurrency),
                    'to' => strtoupper($toCurrency),
                    'date' => $asOf->toDateString(),
                ]);

            if (! $response->successful()) {
                return null;
            }

            $rate = $response->json('rate') ?? $response->json('data.rate');
            if ($rate === null || ! is_numeric($rate)) {
                return null;
            }

            return (float) $rate;
        } catch (\Throwable $e) {
            Log::warning('travel.fx_http_fetch_failed', ['message' => $e->getMessage()]);

            return null;
        }
    }
}
