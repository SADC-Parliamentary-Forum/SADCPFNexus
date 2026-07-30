<?php

namespace App\Modules\PeopleAuthority\Drivers\Certificate;

use App\Modules\PeopleAuthority\Contracts\CertificateSignatureDriverInterface;
use InvalidArgumentException;

final class CertificateSignatureDriverFactory
{
    /** @var array<string, class-string<CertificateSignatureDriverInterface>> */
    private const BUILTIN = [
        'stub' => StubCertificateDriver::class,
        'pkcs11_http' => Pkcs11HttpCertificateDriver::class,
    ];

    public function make(?string $driver = null): CertificateSignatureDriverInterface
    {
        $driver = strtolower(trim((string) ($driver ?? config('people_authority.certificate_driver', 'stub'))));
        if ($driver === '') {
            $driver = 'stub';
        }
        if (! isset(self::BUILTIN[$driver])) {
            throw new InvalidArgumentException(
                "Unknown certificate signature driver [{$driver}]. Allowed: stub, pkcs11_http."
            );
        }

        return app(self::BUILTIN[$driver]);
    }
}
