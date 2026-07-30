<?php

namespace App\Modules\Travel\Services;

use App\Modules\Travel\Contracts\GdsProviderInterface;
use InvalidArgumentException;

final class GdsProviderFactory
{
    /**
     * @var array<string, class-string<GdsProviderInterface>>
     */
    private const BUILTIN = [
        'null' => NullGdsProvider::class,
        'disabled' => NullGdsProvider::class,
        'generic_http' => GenericHttpGdsProvider::class,
    ];

    public function make(?string $driver = null): GdsProviderInterface
    {
        $driver = strtolower(trim((string) ($driver ?? config('travel.gds_driver', 'null'))));
        if ($driver === '') {
            $driver = 'null';
        }

        if (! isset(self::BUILTIN[$driver])) {
            throw new InvalidArgumentException(
                "Unknown travel GDS driver [{$driver}]. Allowed: null, disabled, generic_http."
            );
        }

        return app(self::BUILTIN[$driver]);
    }
}
