<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\DB;
use PragmaRX\Google2FA\Google2FA;

/**
 * TOTP codes and one-time recovery codes for a user's second factor.
 *
 * Recovery codes are shown to the user once and stored only as sha256
 * hashes (inside the encrypted mfa_recovery_codes column); each code works
 * once and is removed when used.
 */
final class SecondFactor
{
    public const RECOVERY_CODE_COUNT = 8;

    /**
     * Verify a TOTP code or consume a recovery code.
     *
     * @return 'totp'|'recovery'|null which factor matched, or null when none did
     */
    public static function verify(User $user, string $code): ?string
    {
        $code = trim($code);
        if ($code === '' || ! $user->mfa_secret) {
            return null;
        }

        if (preg_match('/^\d{6}$/', $code) === 1) {
            return (new Google2FA)->verifyKey($user->mfa_secret, $code) ? 'totp' : null;
        }

        return self::consumeRecoveryCode($user, $code) ? 'recovery' : null;
    }

    public static function verifyTotp(User $user, string $code): bool
    {
        return $user->mfa_secret !== null
            && preg_match('/^\d{6}$/', trim($code)) === 1
            && (new Google2FA)->verifyKey($user->mfa_secret, trim($code));
    }

    /**
     * Replace the user's recovery codes. Returns the plaintext codes, which
     * must be shown to the user now — they cannot be recovered later.
     *
     * @return string[]
     */
    public static function regenerateRecoveryCodes(User $user): array
    {
        $codes = [];
        for ($i = 0; $i < self::RECOVERY_CODE_COUNT; $i++) {
            $raw = strtolower(bin2hex(random_bytes(5))); // 10 hex chars
            $codes[] = substr($raw, 0, 5).'-'.substr($raw, 5);
        }

        $user->forceFill([
            'mfa_recovery_codes' => array_map(fn (string $c) => self::hash($c), $codes),
        ])->save();

        return $codes;
    }

    public static function remainingRecoveryCodes(User $user): int
    {
        return count($user->mfa_recovery_codes ?? []);
    }

    private static function consumeRecoveryCode(User $user, string $code): bool
    {
        $candidate = self::hash($code);

        // Lock the user row so two concurrent sign-ins cannot both spend the same
        // code, and two different codes cannot overwrite each other's removal.
        $remaining = DB::transaction(function () use ($user, $candidate) {
            $locked = User::whereKey($user->getKey())->lockForUpdate()->first();
            $hashes = $locked?->mfa_recovery_codes ?? [];

            foreach ($hashes as $index => $stored) {
                if (is_string($stored) && hash_equals($stored, $candidate)) {
                    unset($hashes[$index]);
                    $locked->forceFill(['mfa_recovery_codes' => array_values($hashes)])->save();

                    return array_values($hashes);
                }
            }

            return null;
        });

        if ($remaining === null) {
            return false;
        }
        $user->setAttribute('mfa_recovery_codes', $remaining);
        $user->syncOriginalAttribute('mfa_recovery_codes');

        return true;
    }

    private static function hash(string $code): string
    {
        // Normalise so "ABCDE-12345", "abcde12345" and spaced input all match.
        return hash('sha256', strtolower(preg_replace('/[^a-z0-9]/i', '', $code) ?? ''));
    }
}
