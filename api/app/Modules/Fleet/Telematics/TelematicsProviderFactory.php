<?php

namespace App\Modules\Fleet\Telematics;

use App\Modules\Fleet\Contracts\TelematicsProvider;
use InvalidArgumentException;

/**
 * Resolves FLEET_TELEMATICS_DRIVER into a TelematicsProvider.
 *
 * Secrets stay in env; unknown drivers fail closed.
 */
final class TelematicsProviderFactory
{
    /**
     * @var array<string, class-string<TelematicsProvider>>
     */
    private const BUILTIN = [
        'null' => NullTelematicsProvider::class,
        'disabled' => NullTelematicsProvider::class,
        'generic_http' => GenericHttpTelematicsProvider::class,
        // Webhook-only mode: poll is a no-op; intake uses TelematicsSyncService::applyWebhookPayload.
        'http_webhook' => NullTelematicsProvider::class,
    ];

    public function make(?string $driver = null): TelematicsProvider
    {
        $driver = strtolower(trim((string) ($driver ?? config('fleet_telematics.driver', 'null'))));
        if ($driver === '') {
            $driver = 'null';
        }

        if (! isset(self::BUILTIN[$driver])) {
            throw new InvalidArgumentException(
                "Unknown fleet telematics driver [{$driver}]. Allowed: null, disabled, generic_http, http_webhook."
            );
        }

        $class = self::BUILTIN[$driver];

        // http_webhook uses NullTelematicsProvider for poll but reports its own name via wrapper.
        if ($driver === 'http_webhook') {
            return new class implements TelematicsProvider
            {
                public function fetchPositions(array $deviceIds = []): array
                {
                    return [];
                }

                public function name(): string
                {
                    return 'http_webhook';
                }

                public function isEnabled(): bool
                {
                    return false;
                }
            };
        }

        return app($class);
    }

    public function makeFixture(string $path): TelematicsProvider
    {
        return new FixtureTelematicsProvider($path);
    }
}
