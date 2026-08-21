<?php

namespace App\Modules\Notifications\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Generic HTTP SMS / WhatsApp driver. Lives behind env credentials only.
 * Never invents API keys. Vendor-specific gateways sit in front of this contract.
 */
class HttpChannelProvider
{
    public function __construct(
        private readonly string $channel,
        private readonly string $urlConfigKey,
        private readonly string $tokenConfigKey,
        private readonly string $providerName,
    ) {}

    public function isEnabled(): bool
    {
        return filled(config($this->urlConfigKey));
    }

    public function status(): string
    {
        return $this->isEnabled() ? 'HTTP driver configured' : 'Credentials Pending';
    }

    /**
     * @return array{ok: bool, temporary: bool, code: string, summary: string, provider: string, message_id: ?string}
     */
    public function send(string $destination, string $body): array
    {
        if (! filled($destination)) {
            return $this->result(false, false, 'missing_destination', 'Destination is required', null);
        }

        if (! $this->isEnabled()) {
            return $this->result(
                false,
                false,
                $this->channel.'_credentials_pending',
                strtoupper($this->channel).' HTTP URL is not configured',
                null
            );
        }

        try {
            $response = Http::withToken((string) config($this->tokenConfigKey, ''))
                ->timeout(10)
                ->post((string) config($this->urlConfigKey), [
                    'channel' => $this->channel,
                    'destination' => $destination,
                    'body' => $body,
                ]);

            if (! $response->successful()) {
                $temporary = $response->status() >= 500 || $response->status() === 429;

                return $this->result(
                    false,
                    $temporary,
                    'http_'.$response->status(),
                    substr($response->body(), 0, 500),
                    null
                );
            }

            return $this->result(
                true,
                false,
                'accepted',
                'HTTP '.$this->channel.' accepted',
                (string) ($response->json('id') ?? $this->providerName.'-'.uniqid())
            );
        } catch (\Throwable $e) {
            Log::warning('notifications.http_channel_failed', [
                'channel' => $this->channel,
                'error' => $e->getMessage(),
                'destination_hash' => hash('sha256', $destination),
            ]);

            return $this->result(false, true, 'http_exception', $e->getMessage(), null);
        }
    }

    /**
     * @return array{ok: bool, temporary: bool, code: string, summary: string, provider: string, message_id: ?string}
     */
    private function result(bool $ok, bool $temporary, string $code, string $summary, ?string $messageId): array
    {
        return [
            'ok' => $ok,
            'temporary' => $temporary,
            'code' => $code,
            'summary' => $summary,
            'provider' => $this->providerName,
            'message_id' => $messageId,
        ];
    }
}
