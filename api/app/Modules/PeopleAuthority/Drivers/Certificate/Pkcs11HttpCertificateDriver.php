<?php

namespace App\Modules\PeopleAuthority\Drivers\Certificate;

use App\Modules\PeopleAuthority\Contracts\CertificateSignatureDriverInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

final class Pkcs11HttpCertificateDriver implements CertificateSignatureDriverInterface
{
    public function driverName(): string
    {
        return 'pkcs11_http';
    }

    public function enrolFromCertificate(array $input): array
    {
        $url = (string) config('people_authority.certificate_http_url');
        if ($url === '') {
            throw ValidationException::withMessages([
                'certificate' => ['PEOPLE_AUTHORITY_CERTIFICATE_HTTP_URL is not configured.'],
            ]);
        }

        $token = (string) config('people_authority.certificate_http_token');
        $response = Http::timeout(20)
            ->withToken($token)
            ->acceptJson()
            ->post(rtrim($url, '/').'/enrol', [
                'thumbprint' => $input['thumbprint'] ?? null,
                'subject' => $input['subject'] ?? null,
                'certificate_pem' => $input['certificate_pem'] ?? null,
            ]);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'certificate' => ['Certificate enrolment gateway returned HTTP '.$response->status()],
            ]);
        }

        $data = $response->json() ?? [];

        return [
            'subject' => $data['subject'] ?? ($input['subject'] ?? null),
            'thumbprint' => $data['thumbprint'] ?? ($input['thumbprint'] ?? null),
            'expires_at' => $data['expires_at'] ?? ($input['expires_at'] ?? null),
            'meta' => [
                'driver' => 'pkcs11_http',
                'gateway' => parse_url($url, PHP_URL_HOST),
            ],
            'authentication_strength' => 'certificate',
        ];
    }

    public function attestSignature(array $input): array
    {
        $url = (string) config('people_authority.certificate_http_url');
        if ($url === '') {
            throw ValidationException::withMessages([
                'certificate' => ['PEOPLE_AUTHORITY_CERTIFICATE_HTTP_URL is not configured.'],
            ]);
        }

        $response = Http::timeout(20)
            ->withToken((string) config('people_authority.certificate_http_token'))
            ->acceptJson()
            ->post(rtrim($url, '/').'/attest', $input);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'certificate' => ['Certificate attest gateway returned HTTP '.$response->status()],
            ]);
        }

        $data = $response->json() ?? [];

        return [
            'method' => 'certificate',
            'verification_reference' => $data['verification_reference'] ?? null,
            'authentication_strength' => 'certificate',
        ];
    }
}
