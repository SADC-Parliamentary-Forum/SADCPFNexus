<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\GdsProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Generic HTTP GDS bridge — URL/token from env only. Never embeds vendor keys.
 */
class GenericHttpGdsProvider implements GdsProviderInterface
{
    public function name(): string
    {
        return 'generic_http';
    }

    public function isEnabled(): bool
    {
        return filled(config('travel.gds_http_url'));
    }

    public function fetchItinerary(string $bookingReference): ?array
    {
        $url = config('travel.gds_http_url');
        if (! $url) {
            return null;
        }

        try {
            $req = Http::timeout(10)->acceptJson();
            $token = config('travel.gds_http_token');
            if ($token) {
                $req = $req->withToken($token);
            }
            $res = $req->get(rtrim($url, '/').'/itinerary/'.urlencode($bookingReference));
            if (! $res->successful()) {
                return null;
            }
            $json = $res->json();
            if (! is_array($json)) {
                return null;
            }

            return [
                'raw_text' => $json['raw_text'] ?? null,
                'legs' => $json['legs'] ?? [],
            ];
        } catch (\Throwable $e) {
            Log::warning('travel.gds_http_fetch_failed', ['message' => $e->getMessage()]);

            return null;
        }
    }
}
