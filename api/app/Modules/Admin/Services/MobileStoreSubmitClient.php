<?php

namespace App\Modules\Admin\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Play Store / App Store Connect HTTP submitters.
 * Fail closed when credentials are absent. Never invents signing material.
 */
class MobileStoreSubmitClient
{
    public function playStatus(): array
    {
        $path = (string) config('services.play_store.service_account_json', env('PLAY_STORE_SERVICE_ACCOUNT_JSON'));
        $url = (string) config('services.play_store.http_url', env('PLAY_STORE_HTTP_URL'));

        return [
            'configured' => (filled($path) && is_readable($path)) || filled($url),
            'driver' => filled($url) ? 'http' : 'status_only',
        ];
    }

    public function appStoreStatus(): array
    {
        $key = (string) config('services.app_store.key_id', env('ASC_KEY_ID'));
        $url = (string) config('services.app_store.http_url', env('ASC_HTTP_URL'));

        return [
            'configured' => filled($key) || filled($url),
            'driver' => filled($url) ? 'http' : 'status_only',
        ];
    }

    public function submitPlay(array $payload = []): array
    {
        $url = (string) config('services.play_store.http_url', env('PLAY_STORE_HTTP_URL'));
        if ($url === '') {
            return ['ok' => false, 'code' => 'credentials_pending', 'message' => 'PLAY_STORE_HTTP_URL is not configured.'];
        }

        return $this->post($url, (string) env('PLAY_STORE_HTTP_TOKEN'), $payload);
    }

    public function submitAppStore(array $payload = []): array
    {
        $url = (string) config('services.app_store.http_url', env('ASC_HTTP_URL'));
        if ($url === '') {
            return ['ok' => false, 'code' => 'credentials_pending', 'message' => 'ASC_HTTP_URL is not configured.'];
        }

        return $this->post($url, (string) env('ASC_HTTP_TOKEN'), $payload);
    }

    private function post(string $url, string $token, array $payload): array
    {
        try {
            $req = Http::timeout(20)->acceptJson();
            if ($token !== '') {
                $req = $req->withToken($token);
            }
            $response = $req->post($url, $payload);
            if (! $response->successful()) {
                return ['ok' => false, 'code' => 'http_'.$response->status(), 'message' => 'Store submit rejected.'];
            }

            return ['ok' => true, 'code' => 'accepted', 'message' => 'Store submit accepted.', 'id' => $response->json('id')];
        } catch (\Throwable $e) {
            Log::warning('store.submit_failed', ['message' => $e->getMessage()]);

            return ['ok' => false, 'code' => 'exception', 'message' => $e->getMessage()];
        }
    }
}
