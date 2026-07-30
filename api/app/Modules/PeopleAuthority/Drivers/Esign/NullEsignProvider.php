<?php

namespace App\Modules\PeopleAuthority\Drivers\Esign;

use App\Modules\PeopleAuthority\Contracts\EsignProviderInterface;
use Illuminate\Validation\ValidationException;

final class NullEsignProvider implements EsignProviderInterface
{
    public function driverName(): string
    {
        return 'null';
    }

    public function isConfigured(): bool
    {
        return false;
    }

    public function submit(array $request): array
    {
        throw ValidationException::withMessages([
            'esign' => ['External e-sign provider is not configured (PEOPLE_AUTHORITY_ESIGN_DRIVER=null).'],
        ]);
    }
}
