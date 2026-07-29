<?php

namespace App\Modules\Fleet\Telematics;

use App\Modules\Fleet\Contracts\TelematicsProvider;
use Illuminate\Support\Facades\Http;
use RuntimeException;

/**
 * Poll a configurable REST endpoint for JSON positions.
 * Does not require a named paid vendor — any endpoint returning the documented shape works.
 *
 * Auth: optional Bearer FLEET_TELEMATICS_API_KEY (or X-Api-Key header).
 */
final class GenericHttpTelematicsProvider implements TelematicsProvider
{
    public function fetchPositions(array $deviceIds = []): array
    {
        $url = trim((string) config('fleet_telematics.base_url', ''));
        if ($url === '') {
            throw new RuntimeException(
                'FLEET_TELEMATICS_BASE_URL is required when FLEET_TELEMATICS_DRIVER=generic_http.'
            );
        }

        $timeout = max(1, (int) config('fleet_telematics.http_timeout', 20));
        $apiKey = trim((string) config('fleet_telematics.api_key', ''));

        $request = Http::timeout($timeout)->acceptJson();
        if ($apiKey !== '') {
            $request = $request
                ->withToken($apiKey)
                ->withHeaders(['X-Api-Key' => $apiKey]);
        }

        $query = [];
        if ($deviceIds !== []) {
            $query['device_ids'] = implode(',', $deviceIds);
        }

        $response = $request->get($url, $query);

        if (! $response->successful()) {
            throw new RuntimeException(
                "Telematics HTTP poll failed with status {$response->status()}."
            );
        }

        return TelematicsJsonParser::parse($response->json());
    }

    public function name(): string
    {
        return 'generic_http';
    }

    public function isEnabled(): bool
    {
        return true;
    }
}
