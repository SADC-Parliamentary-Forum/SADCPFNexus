<?php

namespace App\Support;

use App\Models\PasswordHistory;
use App\Models\User;
use Closure;
use Illuminate\Support\Facades\Hash;

class PasswordPolicy
{
    /**
     * Verify hashes created by the current or a previously configured driver.
     * The configured Argon2id verifier rejects legacy bcrypt hashes before the
     * login flow can upgrade them.
     */
    public static function check(string $plainPassword, ?string $hash): bool
    {
        if (! is_string($hash) || $hash === '') {
            return false;
        }

        $algorithm = password_get_info($hash)['algoName'] ?? '';

        return match ($algorithm) {
            'bcrypt' => Hash::driver('bcrypt')->check($plainPassword, $hash),
            'argon2i' => Hash::driver('argon')->check($plainPassword, $hash),
            'argon2id' => Hash::driver('argon2id')->check($plainPassword, $hash),
            default => false,
        };
    }

    public static function needsRehash(?string $hash): bool
    {
        if (! is_string($hash) || ! str_starts_with($hash, '$argon2id$')) {
            return true;
        }

        return Hash::needsRehash($hash);
    }

    public static function rules(?User $user = null, array $context = [], bool $confirmed = true): array
    {
        $min = max(8, (int) config('auth_lifecycle.password_min', 12));
        $max = max(64, (int) config('auth_lifecycle.password_max', 128));

        $rules = [
            'required',
            'string',
            "min:{$min}",
            "max:{$max}",
            self::complexityRule(),
            self::contextRule($user, $context),
            self::historyRule($user),
        ];

        if ($confirmed) {
            $rules[] = 'confirmed';
        }

        return $rules;
    }

    public static function applyNewPassword(User $user, string $plainPassword, array $extra = []): void
    {
        $previousHash = $user->getRawOriginal('password') ?? $user->password;

        if (is_string($previousHash) && $previousHash !== '') {
            PasswordHistory::create([
                'user_id' => $user->id,
                'password' => $previousHash,
                'created_at' => now(),
            ]);
        }

        $user->forceFill(array_merge([
            'password' => Hash::make($plainPassword),
            'password_changed_at' => now(),
            'must_reset_password' => false,
            'remember_token' => \Illuminate\Support\Str::random(60),
        ], $extra))->save();

        self::pruneHistory($user);
    }

    public static function markExpiredIfNeeded(User $user): bool
    {
        $maxAgeDays = (int) config('auth_lifecycle.password_max_age_days', 90);
        if ($maxAgeDays <= 0 || $user->must_reset_password) {
            return (bool) $user->must_reset_password;
        }

        $changedAt = $user->password_changed_at;
        if (! $changedAt) {
            return false;
        }

        if ($changedAt->lte(now()->subDays($maxAgeDays))) {
            $user->forceFill(['must_reset_password' => true])->save();

            return true;
        }

        return false;
    }

    private static function complexityRule(): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail): void {
            $password = (string) $value;

            if (! preg_match('/[a-z]/', $password)
                || ! preg_match('/[A-Z]/', $password)
                || ! preg_match('/[0-9]/', $password)
                || ! preg_match('/[^A-Za-z0-9]/', $password)
            ) {
                $fail('The password must include upper and lower case letters, a number, and a symbol.');
            }
        };
    }

    private static function contextRule(?User $user, array $context): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($user, $context): void {
            $password = (string) $value;
            $normalised = strtolower(trim($password));
            $compacted = preg_replace('/\s+/', '', $normalised) ?? $normalised;

            $blocked = collect(config('auth_lifecycle.common_passwords', []))
                ->map(static fn (string $candidate): string => strtolower(trim($candidate)))
                ->filter()
                ->all();

            if (in_array($normalised, $blocked, true) || in_array($compacted, $blocked, true)) {
                $fail('Choose a less common password or passphrase.');
                return;
            }

            $identityFragments = [];

            if ($user) {
                $identityFragments[] = strtok(strtolower((string) $user->email), '@') ?: null;
                $identityFragments[] = strtolower((string) $user->name);
                $identityFragments[] = strtolower((string) $user->employee_number);
            }

            foreach (['email', 'name', 'employee_number'] as $key) {
                if (! empty($context[$key])) {
                    $value = strtolower((string) $context[$key]);
                    $identityFragments[] = $key === 'email' ? (strtok($value, '@') ?: $value) : $value;
                }
            }

            foreach (array_filter($identityFragments) as $fragment) {
                $fragment = preg_replace('/[^a-z0-9]+/', '', (string) $fragment) ?? '';
                if (strlen($fragment) >= 4 && str_contains($compacted, $fragment)) {
                    $fail('The password must not contain obvious account details.');
                    return;
                }
            }
        };
    }

    private static function historyRule(?User $user): Closure
    {
        return function (string $attribute, mixed $value, Closure $fail) use ($user): void {
            if (! $user) {
                return;
            }

            $plain = (string) $value;
            $limit = max(0, (int) config('auth_lifecycle.password_history_count', 5));

            $currentHash = $user->getRawOriginal('password') ?? $user->password;
            if (is_string($currentHash) && $currentHash !== '' && self::check($plain, $currentHash)) {
                $fail('The password must not match a recently used password.');
                return;
            }

            if ($limit <= 0) {
                return;
            }

            $histories = PasswordHistory::query()
                ->where('user_id', $user->id)
                ->orderByDesc('created_at')
                ->orderByDesc('id')
                ->limit($limit)
                ->get(['password']);

            foreach ($histories as $history) {
                if (self::check($plain, (string) $history->password)) {
                    $fail('The password must not match a recently used password.');
                    return;
                }
            }
        };
    }

    private static function pruneHistory(User $user): void
    {
        $limit = max(0, (int) config('auth_lifecycle.password_history_count', 5));
        if ($limit <= 0) {
            PasswordHistory::where('user_id', $user->id)->delete();
            return;
        }

        $keepIds = PasswordHistory::query()
            ->where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->orderByDesc('id')
            ->limit($limit)
            ->pluck('id');

        PasswordHistory::query()
            ->where('user_id', $user->id)
            ->when($keepIds->isNotEmpty(), fn ($q) => $q->whereNotIn('id', $keepIds))
            ->delete();
    }
}
