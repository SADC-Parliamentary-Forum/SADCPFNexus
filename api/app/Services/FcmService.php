<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Firebase Cloud Messaging v1 HTTP API sender.
 *
 * Requires the following in config/services.php or .env:
 *   FCM_PROJECT_ID=your-firebase-project-id
 *   FCM_SERVICE_ACCOUNT_JSON=/path/to/service-account.json
 *      OR
 *   FCM_CLIENT_EMAIL=firebase-adminsdk@project.iam.gserviceaccount.com
 *   Provide the matching service-account private key value via config/services.php.
 *
 * If credentials are not configured the service silently skips sending.
 */
class FcmService
{
    private ?string $projectId;
    private ?string $clientEmail;
    private ?string $privateKey;

    public function __construct()
    {
        $this->projectId = config('services.fcm.project_id');

        // Support both a JSON file path and individual env vars
        $jsonPath = config('services.fcm.service_account_json');
        if ($jsonPath && file_exists($jsonPath)) {
            $json = json_decode(file_get_contents($jsonPath), true);
            $this->clientEmail = $json['client_email'] ?? null;
            $this->privateKey  = $json['private_key']  ?? null;
        } else {
            $this->clientEmail = config('services.fcm.client_email');
            $this->privateKey  = str_replace('\\n', "\n", config('services.fcm.private_key', ''));
        }
    }

    /**
     * Returns true if FCM credentials are configured.
     */
    public function isConfigured(): bool
    {
        return $this->projectId && $this->clientEmail && $this->privateKey;
    }

    /**
     * Send a push notification to a single device token.
     */
    public function sendToToken(
        string $deviceToken,
        string $title,
        string $body,
        array $data = []
    ): bool {
        return $this->send([
            'token'        => $deviceToken,
            'notification' => ['title' => $title, 'body' => $body],
            'data'         => array_map('strval', $data),
        ]);
    }

    /**
     * Send a push notification to multiple device tokens.
     * FCM v1 doesn't support multicast natively — we batch individual sends.
     */
    public function sendToTokens(
        array $deviceTokens,
        string $title,
        string $body,
        array $data = []
    ): int {
        $sent = 0;
        foreach ($deviceTokens as $token) {
            if ($this->sendToToken($token, $title, $body, $data)) {
                $sent++;
            }
        }
        return $sent;
    }

    // -------------------------------------------------------------------------

    private function send(array $message): bool
    {
        if (! $this->isConfigured()) {
            return false;
        }

        try {
            $accessToken = $this->getAccessToken();
            if (! $accessToken) {
                return false;
            }

            $url      = "https://fcm.googleapis.com/v1/projects/{$this->projectId}/messages:send";
            $response = Http::withToken($accessToken)
                ->timeout(10)
                ->post($url, ['message' => $message]);

            if (! $response->successful()) {
                Log::warning('FCM send failed', [
                    'status' => $response->status(),
                    'body'   => $response->body(),
                ]);
                return false;
            }

            return true;
        } catch (\Throwable $e) {
            Log::error('FCM exception: ' . $e->getMessage());
            return false;
        }
    }

    /**
     * Obtain a short-lived OAuth2 access token from Google using a service account JWT.
     * Implements RFC 7523 (JWT Bearer Token Grants) without external packages.
     */
    private function getAccessToken(): ?string
    {
        try {
            $now    = time();
            $header = $this->base64url(json_encode(['alg' => 'RS256', 'typ' => 'JWT']));
            $claims = $this->base64url(json_encode([
                'iss'   => $this->clientEmail,
                'scope' => 'https://www.googleapis.com/auth/firebase.messaging',
                'aud'   => 'https://oauth2.googleapis.com/token',
                'iat'   => $now,
                'exp'   => $now + 3600,
            ]));

            $signingInput = "{$header}.{$claims}";
            $signature    = '';

            if (! openssl_sign($signingInput, $signature, $this->privateKey, 'sha256WithRSAEncryption')) {
                Log::error('FCM: openssl_sign failed — check FCM_PRIVATE_KEY format');
                return null;
            }

            $jwt = "{$signingInput}." . $this->base64url($signature);

            $response = Http::asForm()
                ->timeout(10)
                ->post('https://oauth2.googleapis.com/token', [
                    'grant_type' => 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                    'assertion'  => $jwt,
                ]);

            return $response->json('access_token');
        } catch (\Throwable $e) {
            Log::error('FCM getAccessToken exception: ' . $e->getMessage());
            return null;
        }
    }

    private function base64url(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }
}
