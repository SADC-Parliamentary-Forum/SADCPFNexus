<?php

namespace App\Modules\PeopleAuthority\Drivers\Esign;

use App\Modules\PeopleAuthority\Contracts\EsignProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

final class GenericHttpEsignProvider implements EsignProviderInterface
{
    public function driverName(): string
    {
        return 'generic_http';
    }

    public function isConfigured(): bool
    {
        return filled(config('people_authority.esign_http_url'))
            && filled(config('people_authority.esign_http_token'));
    }

    public function submit(array $request): array
    {
        if (! $this->isConfigured()) {
            throw ValidationException::withMessages([
                'esign' => ['Set PEOPLE_AUTHORITY_ESIGN_HTTP_URL and PEOPLE_AUTHORITY_ESIGN_HTTP_TOKEN via server env.'],
            ]);
        }

        $url = rtrim((string) config('people_authority.esign_http_url'), '/');
        $timeout = (int) config('people_authority.esign_http_timeout', 20);
        $response = Http::timeout($timeout)
            ->withToken((string) config('people_authority.esign_http_token'))
            ->acceptJson()
            ->post($url.'/envelopes', [
                'document_type' => $request['document_type'],
                'document_id' => $request['document_id'],
                'document_hash' => $request['document_hash'],
                'recipients' => $request['recipients'] ?? [],
                'payload' => $request['payload'] ?? [],
            ]);

        if (! $response->successful()) {
            throw ValidationException::withMessages([
                'esign' => ['E-sign provider returned HTTP '.$response->status()],
            ]);
        }

        $data = $response->json() ?? [];

        return [
            'external_id' => $data['id'] ?? $data['external_id'] ?? null,
            'status' => $data['status'] ?? 'submitted',
            'response' => $data,
        ];
    }
}
