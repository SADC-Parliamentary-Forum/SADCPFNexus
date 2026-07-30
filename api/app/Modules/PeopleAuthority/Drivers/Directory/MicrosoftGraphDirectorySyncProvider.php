<?php

namespace App\Modules\PeopleAuthority\Drivers\Directory;

use App\Modules\PeopleAuthority\Contracts\DirectorySyncProviderInterface;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

final class MicrosoftGraphDirectorySyncProvider implements DirectorySyncProviderInterface
{
    public function driverName(): string
    {
        return 'microsoft_graph';
    }

    public function isConfigured(): bool
    {
        return filled(config('people_authority.m365_tenant_id'))
            && filled(config('people_authority.m365_client_id'))
            && filled(config('people_authority.m365_client_secret'));
    }

    public function fetchPeople(): array
    {
        if (! $this->isConfigured()) {
            throw ValidationException::withMessages([
                'm365' => ['Set PEOPLE_AUTHORITY_M365_TENANT_ID / CLIENT_ID / CLIENT_SECRET via server env.'],
            ]);
        }

        $tenant = (string) config('people_authority.m365_tenant_id');
        $tokenResponse = Http::asForm()->post(
            "https://login.microsoftonline.com/{$tenant}/oauth2/v2.0/token",
            [
                'client_id' => (string) config('people_authority.m365_client_id'),
                'client_secret' => (string) config('people_authority.m365_client_secret'),
                'scope' => 'https://graph.microsoft.com/.default',
                'grant_type' => 'client_credentials',
            ]
        );

        if (! $tokenResponse->successful()) {
            throw ValidationException::withMessages([
                'm365' => ['Microsoft Graph token request failed (HTTP '.$tokenResponse->status().').'],
            ]);
        }

        $accessToken = $tokenResponse->json('access_token');
        if (! is_string($accessToken) || $accessToken === '') {
            throw ValidationException::withMessages(['m365' => ['Microsoft Graph token missing access_token.']]);
        }

        $usersResponse = Http::withToken($accessToken)
            ->acceptJson()
            ->get('https://graph.microsoft.com/v1.0/users', [
                '$select' => 'id,displayName,givenName,surname,mail,userPrincipalName,jobTitle,department',
                '$top' => 100,
            ]);

        if (! $usersResponse->successful()) {
            throw ValidationException::withMessages([
                'm365' => ['Microsoft Graph users request failed (HTTP '.$usersResponse->status().').'],
            ]);
        }

        $rows = $usersResponse->json('value') ?? [];
        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $out[] = [
                'external_id' => (string) ($row['id'] ?? ''),
                'display_name' => $row['displayName'] ?? null,
                'given_name' => $row['givenName'] ?? null,
                'surname' => $row['surname'] ?? null,
                'mail' => $row['mail'] ?? $row['userPrincipalName'] ?? null,
                'job_title' => $row['jobTitle'] ?? null,
                'department' => $row['department'] ?? null,
                'raw' => $row,
            ];
        }

        return $out;
    }
}
