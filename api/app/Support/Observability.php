<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Optional crash reporting. No-ops unless SENTRY_LARAVEL_DSN is set and
 * sentry/sentry-laravel is installed. Never hardcode a DSN.
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

        Log::error($e->getMessage(), array_merge($context, [
            'exception'  => $e::class,
            'request_id' => request()?->attributes->get('request_id'),
            'hint'       => 'Set SENTRY_LARAVEL_DSN and install sentry/sentry-laravel to forward errors.',
        ]));
    }
}
