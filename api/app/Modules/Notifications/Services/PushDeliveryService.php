<?php

namespace App\Modules\Notifications\Services;

use App\Models\DeviceToken;
use App\Models\User;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Phase 2 push device registration + Null/FCM-generic HTTP provider (stub default).
 */
class PushDeliveryService
{
    public function register(User $user, string $token, string $platform = 'android', ?string $deviceName = null, ?string $appVersion = null): DeviceToken
    {
        $row = DeviceToken::updateOrCreate(
            ['token' => $token],
            [
                'user_id' => $user->id,
                'tenant_id' => $user->tenant_id,
                'platform' => $platform,
                'device_name' => $deviceName,
                'app_version' => $appVersion,
                'push_enabled' => true,
                'revoked_at' => null,
                'last_used_at' => now(),
            ]
        );

        return $row;
    }

    public function refresh(User $user, string $oldToken, string $newToken): DeviceToken
    {
        DeviceToken::query()
            ->where('user_id', $user->id)
            ->where('token', $oldToken)
            ->update(['revoked_at' => now(), 'push_enabled' => false]);

        return $this->register($user, $newToken);
    }

    public function revoke(User $user, string $token): void
    {
        DeviceToken::query()
            ->where('user_id', $user->id)
            ->where('token', $token)
            ->update(['revoked_at' => now(), 'push_enabled' => false]);
    }

    /**
     * @return array{ok: bool, provider: string, message_id: ?string, temporary: bool, code: string, summary: string}
     */
    public function send(User $recipient, string $title, string $body, array $data = []): array
    {
        $tokens = DeviceToken::query()
            ->where('user_id', $recipient->id)
            ->whereNull('revoked_at')
            ->where('push_enabled', true)
            ->pluck('token')
            ->all();

        if ($tokens === []) {
            return [
                'ok' => false,
                'provider' => 'none',
                'message_id' => null,
                'temporary' => false,
                'code' => 'no_device',
                'summary' => 'No active device tokens',
            ];
        }

        $provider = (string) config('notifications.push_provider', 'null');

        if ($provider === 'null') {
            return [
                'ok' => true,
                'provider' => 'null',
                'message_id' => 'null-push-'.uniqid(),
                'temporary' => false,
                'code' => 'stub_accepted',
                'summary' => 'Null push provider accepted (stub default)',
            ];
        }

        if ($provider === 'fcm') {
            $httpUrl = config('notifications.fcm_http_url');
            if ($httpUrl) {
                return $this->sendGenericHttp($httpUrl, $tokens, $title, $body, $data);
            }

            $fcm = app(\App\Services\FcmService::class);
            if (! $fcm->isConfigured()) {
                return [
                    'ok' => true,
                    'provider' => 'fcm_null_fallback',
                    'message_id' => 'fcm-unconfigured-'.uniqid(),
                    'temporary' => false,
                    'code' => 'provider_not_configured',
                    'summary' => 'FCM not configured — stub acceptance (no live send)',
                ];
            }

            $sent = $fcm->sendToTokens($tokens, $title, $body, $data);

            return [
                'ok' => $sent > 0,
                'provider' => 'fcm',
                'message_id' => $sent > 0 ? 'fcm-'.$sent : null,
                'temporary' => $sent === 0,
                'code' => $sent > 0 ? 'fcm_ok' : 'fcm_zero_sent',
                'summary' => "FCM sent={$sent}",
            ];
        }

        return [
            'ok' => false,
            'provider' => $provider,
            'message_id' => null,
            'temporary' => false,
            'code' => 'unknown_provider',
            'summary' => 'Unknown push provider',
        ];
    }

    public function privacySafeTitle(string $subject, string $confidentiality): string
    {
        if (in_array($confidentiality, ['restricted', 'confidential', 'highly_confidential', 'security_sensitive'], true)) {
            return 'Nexus notification';
        }

        return $subject ?: 'Nexus notification';
    }

    public function privacySafeBody(): string
    {
        return (string) config('notifications.push_privacy_body', 'Sign in to Nexus to view details.');
    }

    /**
     * @return array{ok: bool, provider: string, message_id: ?string, temporary: bool, code: string, summary: string}
     */
    private function sendGenericHttp(string $url, array $tokens, string $title, string $body, array $data): array
    {
        try {
            $response = Http::withToken((string) config('notifications.fcm_http_token', ''))
                ->timeout(10)
                ->post($url, [
                    'tokens' => $tokens,
                    'notification' => ['title' => $title, 'body' => $body],
                    'data' => array_map('strval', $data),
                ]);

            if (! $response->successful()) {
                return [
                    'ok' => false,
                    'provider' => 'fcm_http',
                    'message_id' => null,
                    'temporary' => $response->status() >= 500 || $response->status() === 429,
                    'code' => 'http_'.$response->status(),
                    'summary' => substr($response->body(), 0, 500),
                ];
            }

            return [
                'ok' => true,
                'provider' => 'fcm_http',
                'message_id' => (string) ($response->json('id') ?? 'fcm-http-'.uniqid()),
                'temporary' => false,
                'code' => 'accepted',
                'summary' => 'Generic FCM HTTP accepted',
            ];
        } catch (\Throwable $e) {
            Log::warning('Push HTTP provider failed: '.$e->getMessage());

            return [
                'ok' => false,
                'provider' => 'fcm_http',
                'message_id' => null,
                'temporary' => true,
                'code' => 'http_exception',
                'summary' => $e->getMessage(),
            ];
        }
    }
}
