<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use App\Support\SecondFactor;
use Illuminate\Foundation\Testing\TestCase;
use PragmaRX\Google2FA\Google2FA;

/** Exercises TOTP checks on unsaved users only, so it skips the base TestCase's database refresh. */
class SecondFactorUnusableSecretTest extends TestCase
{
    private function userWithSecret(string $secret): User
    {
        return (new User)->forceFill(['id' => 17, 'mfa_enabled' => true, 'mfa_secret' => $secret]);
    }

    public function test_too_short_secret_is_a_failed_code_not_an_exception(): void
    {
        // google2fa 9.1 throws SecretKeyTooShortException for secrets under 16 base32 chars.
        $user = $this->userWithSecret('JBSWY3DP');

        $this->assertNull(SecondFactor::verify($user, '123456'));
        $this->assertFalse(SecondFactor::verifyTotp($user, '123456'));
    }

    public function test_valid_secret_still_verifies_the_current_code(): void
    {
        $google2fa = new Google2FA;
        $secret = $google2fa->generateSecretKey();
        $user = $this->userWithSecret($secret);

        $this->assertSame('totp', SecondFactor::verify($user, $google2fa->getCurrentOtp($secret)));
    }
}
