<?php

namespace App\Modules\PeopleAuthority\Drivers\Directory;

use App\Modules\PeopleAuthority\Contracts\DirectorySyncProviderInterface;
use InvalidArgumentException;

final class DirectorySyncProviderFactory
{
    /** @var array<string, class-string<DirectorySyncProviderInterface>> */
    private const BUILTIN = [
        'null' => NullDirectorySyncProvider::class,
        'disabled' => NullDirectorySyncProvider::class,
        'fixture' => FixtureDirectorySyncProvider::class,
        'microsoft_graph' => MicrosoftGraphDirectorySyncProvider::class,
    ];

    public function make(?string $driver = null): DirectorySyncProviderInterface
    {
        $driver = strtolower(trim((string) ($driver ?? config('people_authority.m365_driver', 'null'))));
        if ($driver === '') {
            $driver = 'null';
        }
        if (! isset(self::BUILTIN[$driver])) {
            throw new InvalidArgumentException(
                "Unknown M365/directory driver [{$driver}]. Allowed: null, disabled, fixture, microsoft_graph."
            );
        }

        return app(self::BUILTIN[$driver]);
    }
}
