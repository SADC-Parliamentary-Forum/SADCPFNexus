<?php

namespace App\Modules\PeopleAuthority\Drivers\Directory;

use App\Modules\PeopleAuthority\Contracts\DirectorySyncProviderInterface;

final class NullDirectorySyncProvider implements DirectorySyncProviderInterface
{
    public function driverName(): string
    {
        return 'null';
    }

    public function isConfigured(): bool
    {
        return false;
    }

    public function fetchPeople(): array
    {
        return [];
    }
}
