<?php

namespace App\Support;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Optional crash reporting. Uses sentry/sentry-laravel when installed.
 * When a DSN is set but the SDK is absent, posts a minimal envelope over HTTP.
 * Never hardcode a DSN.
 */
final class Observability
{
    public static function captureException(Throwable $e, array $context = []): void
    {
        $dsn = config('services.sentry.dsn');
        if (! is_string($dsn) || $dsn === '') {
            Log::error($e->getMessage(), array_merge($context, [
                'exception'  => $e::class,
                'request_id' => request()?->attributes->get('request_id'),
            ]));

            return;
        }

        if (function_exists('\\Sentry\\captureException')) {
            \Sentry\configureScope(function ($scope) use ($context): void {
                foreach ($context as $key => $value) {
                    if (is_scalar($value) || $value === null) {
                        $scope->setExtra((string) $key, $value);
                    }
                }
                $requestId = request()?->attributes->get('request_id');
                if ($requestId) {
                    $scope->setTag('request_id', (string) $requestId);
                }
            });
            \Sentry\captureException($e);

            return;
        }

        self::postHttpEnvelope($dsn, $e, $context);
    }

    private static function postHttpEnvelope(string $dsn, Throwable $e, array $context): void
    {
        $parts = parse_url($dsn);
        $key = $parts['user'] ?? '';
        $host = $parts['host'] ?? '';
        $project = trim((string) ($parts['path'] ?? ''), '/');
        if ($key === '' || $host === '' || $project === '') {
            Log::error($e->getMessage(), array_merge($context, [
                'exception' => $e::class,
                'hint' => 'SENTRY_LARAVEL_DSN is set but could not be parsed for HTTP envelope fallback.',
            ]));

            return;
        }

        $url = ($parts['scheme'] ?? 'https').'://'.$host.'/api/'.$project.'/envelope/';
        $eventId = str_replace('-', '', (string) \Illuminate\Support\Str::uuid());
        $header = json_encode([
            'event_id' => $eventId,
            'dsn' => $dsn,
            'sent_at' => now()->toIso8601String(),
        ], JSON_THROW_ON_ERROR);
        $item = json_encode(['type' => 'event', 'content_type' => 'application/json'], JSON_THROW_ON_ERROR);
        $payload = json_encode([
            'event_id' => $eventId,
            'timestamp' => now()->toIso8601String(),
            'platform' => 'php',
            'level' => 'error',
            'exception' => [
                'values' => [[
                    'type' => $e::class,
                    'value' => $e->getMessage(),
                ]],
            ],
            'extra' => array_filter($context, fn ($v) => is_scalar($v) || $v === null),
        ], JSON_THROW_ON_ERROR);
        $body = $header."\n".$item."\n".$payload;

        try {
            Http::timeout(2)
                ->withHeaders([
                    'Content-Type' => 'application/x-sentry-envelope',
                    'X-Sentry-Auth' => 'Sentry sentry_version=7, sentry_client=sadcpf-http/1.0, sentry_key='.$key,
                ])
                ->withBody($body, 'application/x-sentry-envelope')
                ->post($url);
        } catch (Throwable $sendError) {
            Log::error($e->getMessage(), array_merge($context, [
                'exception' => $e::class,
                'sentry_http_fallback' => $sendError->getMessage(),
            ]));
        }
    }
}
