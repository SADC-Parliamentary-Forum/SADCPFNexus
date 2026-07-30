<?php

namespace App\Modules\PeopleAuthority\Drivers\Directory;

use App\Modules\PeopleAuthority\Contracts\DirectorySyncProviderInterface;
use Illuminate\Validation\ValidationException;

final class FixtureDirectorySyncProvider implements DirectorySyncProviderInterface
{
    public function driverName(): string
    {
        return 'fixture';
    }

    public function isConfigured(): bool
    {
        $path = (string) config('people_authority.m365_fixture_path');

        return $path !== '' && is_readable($path);
    }

    public function fetchPeople(): array
    {
        $path = (string) config('people_authority.m365_fixture_path');
        if ($path === '' || ! is_readable($path)) {
            throw ValidationException::withMessages([
                'm365' => ['Fixture path PEOPLE_AUTHORITY_M365_FIXTURE_PATH is missing or unreadable.'],
            ]);
        }

        $json = json_decode((string) file_get_contents($path), true);
        if (! is_array($json)) {
            throw ValidationException::withMessages(['m365' => ['Fixture JSON is invalid.']]);
        }

        $rows = $json['value'] ?? $json['people'] ?? $json;
        if (! is_array($rows)) {
            return [];
        }

        $out = [];
        foreach ($rows as $row) {
            if (! is_array($row)) {
                continue;
            }
            $out[] = [
                'external_id' => (string) ($row['id'] ?? $row['external_id'] ?? uniqid('fix_')),
                'display_name' => $row['displayName'] ?? $row['display_name'] ?? null,
                'given_name' => $row['givenName'] ?? $row['given_name'] ?? null,
                'surname' => $row['surname'] ?? $row['last_name'] ?? null,
                'mail' => $row['mail'] ?? $row['userPrincipalName'] ?? $row['work_email'] ?? null,
                'job_title' => $row['jobTitle'] ?? $row['job_title'] ?? null,
                'department' => $row['department'] ?? null,
                'raw' => $row,
            ];
        }

        return $out;
    }
}
