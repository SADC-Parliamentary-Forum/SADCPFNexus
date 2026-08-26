<?php

namespace App\Modules\Finance\Services;

use App\Models\User;
use Illuminate\Support\Collection;

/**
 * Maps a payslip filename to a tenant user without inventing OCR.
 *
 * Order: exact employee number → unique name-token match → unmatched / ambiguous.
 */
class PayslipFilenameMatcher
{
    private const MONTH_TOKENS = [
        'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
        'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
        'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'JUNE',
        'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
        'PAYSLIP', 'PAYSLIPS', 'SALARY', 'PAYROLL', 'SLIP', 'PDF',
    ];

    /**
     * @param  Collection<int, User>  $users
     * @return array{
     *   status: 'matched'|'ambiguous'|'unmatched',
     *   user: array{id: int, name: string, email: string, employee_number: ?string}|null,
     *   candidates: list<array{id: int, name: string, email: string, employee_number: ?string}>,
     *   extracted_employee_number: ?string
     * }
     */
    public function match(string $filename, Collection $users): array
    {
        $employeeNumber = $this->extractEmployeeNumber($filename);
        if ($employeeNumber !== null) {
            $byNumber = $users->first(function (User $user) use ($employeeNumber) {
                $code = $this->normalizeCode((string) ($user->employee_number ?? ''));
                return $code !== '' && $code === $this->normalizeCode($employeeNumber);
            });
            if ($byNumber) {
                return $this->result('matched', $byNumber, [$byNumber], $employeeNumber);
            }
        }

        $nameHits = $this->matchByNameTokens($filename, $users);
        if (count($nameHits) === 1) {
            return $this->result('matched', $nameHits[0], $nameHits, $employeeNumber);
        }
        if (count($nameHits) > 1) {
            return $this->result('ambiguous', null, $nameHits, $employeeNumber);
        }

        return $this->result('unmatched', null, [], $employeeNumber);
    }

    public function extractEmployeeNumber(string $filename): ?string
    {
        $base = pathinfo($filename, PATHINFO_FILENAME);
        if (preg_match('/\bEMP[-_]?\d+\b/i', $base, $m) === 1) {
            return strtoupper(str_replace(['-', '_'], '', $m[0]));
        }
        if (preg_match('/\b([A-Z]{2,}[-_]\d{2,})\b/i', $base, $m) === 1) {
            return strtoupper(str_replace('_', '-', $m[1]));
        }
        if (preg_match_all('/\b(\d{3,})\b/', $base, $m) >= 1) {
            foreach ($m[1] as $digits) {
                $year = (int) $digits;
                if ($year >= 2020 && $year <= 2100) {
                    continue;
                }
                return $digits;
            }
        }

        return null;
    }

    /**
     * @return list<string>
     */
    public function tokens(string $filename): array
    {
        $base = strtoupper((string) pathinfo($filename, PATHINFO_FILENAME));
        $normalized = preg_replace('/[^A-Z0-9]+/', ' ', $base) ?? '';
        $parts = preg_split('/\s+/', trim($normalized)) ?: [];

        return array_values(array_filter($parts, fn ($t) => $t !== ''));
    }

    /**
     * @param  Collection<int, User>  $users
     * @return list<User>
     */
    private function matchByNameTokens(string $filename, Collection $users): array
    {
        $fileTokens = array_values(array_filter(
            $this->tokens($filename),
            fn (string $t) => ! $this->isNoiseToken($t)
        ));
        if ($fileTokens === []) {
            return [];
        }

        $hits = [];
        foreach ($users as $user) {
            $nameTokens = array_values(array_filter(
                $this->tokens($user->name),
                fn (string $t) => ! $this->isNoiseToken($t) && strlen($t) >= 2
            ));
            if ($nameTokens === []) {
                continue;
            }
            $allPresent = true;
            foreach ($nameTokens as $token) {
                if (! in_array($token, $fileTokens, true)) {
                    $allPresent = false;
                    break;
                }
            }
            if ($allPresent) {
                $hits[] = $user;
            }
        }

        return $hits;
    }

    private function isNoiseToken(string $token): bool
    {
        if (in_array($token, self::MONTH_TOKENS, true)) {
            return true;
        }
        $asInt = (int) $token;
        if ($asInt >= 2020 && $asInt <= 2100 && (string) $asInt === $token) {
            return true;
        }

        return false;
    }

    private function normalizeCode(string $code): string
    {
        return strtoupper(preg_replace('/[\s_-]+/', '', $code) ?? '');
    }

    /**
     * @param  list<User>  $candidates
     * @return array{
     *   status: 'matched'|'ambiguous'|'unmatched',
     *   user: array{id: int, name: string, email: string, employee_number: ?string}|null,
     *   candidates: list<array{id: int, name: string, email: string, employee_number: ?string}>,
     *   extracted_employee_number: ?string
     * }
     */
    private function result(string $status, ?User $user, array $candidates, ?string $extracted): array
    {
        return [
            'status' => $status,
            'user' => $user ? $this->serialize($user) : null,
            'candidates' => array_values(array_map(fn (User $u) => $this->serialize($u), $candidates)),
            'extracted_employee_number' => $extracted,
        ];
    }

    /**
     * @return array{id: int, name: string, email: string, employee_number: ?string}
     */
    private function serialize(User $user): array
    {
        return [
            'id' => (int) $user->id,
            'name' => (string) $user->name,
            'email' => (string) $user->email,
            'employee_number' => $user->employee_number ? (string) $user->employee_number : null,
        ];
    }
}
