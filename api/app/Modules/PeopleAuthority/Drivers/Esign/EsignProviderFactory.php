<?php

namespace App\Modules\PeopleAuthority\Drivers\Esign;

use App\Modules\PeopleAuthority\Contracts\EsignProviderInterface;
use InvalidArgumentException;

final class EsignProviderFactory
{
    /** @var array<string, class-string<EsignProviderInterface>> */
    private const BUILTIN = [
        'null' => NullEsignProvider::class,
        'disabled' => NullEsignProvider::class,
        'generic_http' => GenericHttpEsignProvider::class,
    ];

    public function make(?string $driver = null): EsignProviderInterface
    {
        $driver = strtolower(trim((string) ($driver ?? config('people_authority.esign_driver', 'null'))));
        if ($driver === '') {
            $driver = 'null';
        }
        if (! isset(self::BUILTIN[$driver])) {
            throw new InvalidArgumentException(
                "Unknown e-sign driver [{$driver}]. Allowed: null, disabled, generic_http."
            );
        }

        return app(self::BUILTIN[$driver]);
    }
}
