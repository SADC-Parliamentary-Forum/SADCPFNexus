<?php

namespace App\Modules\PeopleAuthority\Drivers\Certificate;

use App\Modules\PeopleAuthority\Contracts\CertificateSignatureDriverInterface;

final class StubCertificateDriver implements CertificateSignatureDriverInterface
{
    public function driverName(): string
    {
        return 'stub';
    }

    public function enrolFromCertificate(array $input): array
    {
        $thumb = $input['thumbprint'] ?? ('stub-'.substr(hash('sha256', (string) ($input['certificate_pem'] ?? uniqid('cert_', true))), 0, 40));
        $subject = $input['subject'] ?? 'CN=Stub Certificate Enrolment';

        return [
            'subject' => $subject,
            'thumbprint' => $thumb,
            'expires_at' => $input['expires_at'] ?? now()->addYear()->toIso8601String(),
            'meta' => [
                'driver' => 'stub',
                'note' => 'Certificate driver is stub — no private key material accepted or stored.',
            ],
            'authentication_strength' => 'certificate_stub',
        ];
    }

    public function attestSignature(array $input): array
    {
        return [
            'method' => 'certificate_stub',
            'verification_reference' => $input['verification_reference'] ?? ('stub-attest-'.uniqid()),
            'authentication_strength' => 'certificate_stub',
        ];
    }
}
