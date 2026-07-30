<?php

namespace App\Modules\PeopleAuthority\Contracts;

interface CertificateSignatureDriverInterface
{
    public function driverName(): string;

    /**
     * Validate / extract certificate metadata for enrolment. Never stores private keys.
     *
     * @param  array{certificate_pem?:?string,thumbprint?:?string,subject?:?string,expires_at?:?string}  $input
     * @return array{subject:?string,thumbprint:?string,expires_at:?string,meta:array<string,mixed>,authentication_strength:string}
     */
    public function enrolFromCertificate(array $input): array;

    /**
     * Optional signing attestation for certificate-backed signs.
     *
     * @return array{method:string,verification_reference:?string,authentication_strength:string}
     */
    public function attestSignature(array $input): array;
}
