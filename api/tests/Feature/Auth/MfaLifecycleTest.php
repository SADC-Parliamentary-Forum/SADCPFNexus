<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

/**
 * MFA secret storage and recovery/change flows: secrets encrypted at rest,
 * one-time recovery codes, and disabling requires a second factor.
 */
class MfaLifecycleTest extends TestCase
{
    private const PASSWORD = 'Mfa-Lifecycle@2026!';

    private function mfaUser(): array
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'email' => 'mfa.'.uniqid().'@sadcpf.org',
            'password' => Hash::make(self::PASSWORD),
            'is_active' => true,
            'account_status' => User::STATUS_ACTIVE,
            'must_reset_password' => false,
            'password_changed_at' => now(),
        ]);
        $user->assignRole('staff');
        $this->actingAs($user, 'sanctum');

        $secret = $this->postJson('/api/v1/profile/2fa/enable')->assertOk()->json('secret');
        $codes = $this->postJson('/api/v1/profile/2fa/confirm', ['code' => $this->otp($secret)])
            ->assertOk()
            ->assertJsonPath('enabled', true)
            ->json('recovery_codes');

        return [$user->fresh(), $secret, $codes];
    }

    private function otp(string $secret): string
    {
        return (new Google2FA)->getCurrentOtp($secret);
    }

    private function login(User $user, ?string $code)
    {
        return $this->postJson('/api/v1/auth/login', array_filter([
            'email' => $user->email,
            'password' => self::PASSWORD,
            'client_type' => 'mobile',
            'code' => $code,
        ]));
    }

    public function test_secret_is_encrypted_at_rest_and_recovery_codes_are_issued_once(): void
    {
        [$user, $secret, $codes] = $this->mfaUser();

        $raw = DB::table('users')->where('id', $user->id)->value('mfa_secret');
        $this->assertNotSame($secret, $raw, 'TOTP secret stored in plaintext');
        $this->assertSame($secret, Crypt::decryptString($raw));
        $this->assertSame($secret, $user->mfa_secret);

        $this->assertCount(8, $codes);
        $rawCodes = (string) DB::table('users')->where('id', $user->id)->value('mfa_recovery_codes');
        foreach ($codes as $code) {
            $this->assertStringNotContainsString($code, $rawCodes);
        }
        $this->getJson('/api/v1/profile/2fa/status')->assertJsonPath('recovery_codes_remaining', 8);
    }

    public function test_a_recovery_code_signs_in_exactly_once(): void
    {
        [$user, , $codes] = $this->mfaUser();
        $this->app['auth']->forgetGuards();

        $this->login($user, strtoupper($codes[0]))->assertOk()->assertJsonMissingPath('mfa_required');
        $this->login($user, $codes[0])->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->assertSame(7, count($user->fresh()->mfa_recovery_codes));
    }

    public function test_disabling_requires_a_second_factor_not_just_the_password(): void
    {
        [$user, $secret] = $this->mfaUser();

        $this->postJson('/api/v1/profile/2fa/disable', ['password' => self::PASSWORD])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->postJson('/api/v1/profile/2fa/disable', ['password' => self::PASSWORD, 'code' => '000000'])
            ->assertStatus(422)->assertJsonValidationErrors(['code']);
        $this->assertTrue($user->fresh()->mfa_enabled);

        $this->postJson('/api/v1/profile/2fa/disable', ['password' => self::PASSWORD, 'code' => $this->otp($secret)])
            ->assertOk()->assertJsonPath('enabled', false);

        $fresh = $user->fresh();
        $this->assertFalse($fresh->mfa_enabled);
        $this->assertNull($fresh->mfa_secret);
        $this->assertNull($fresh->mfa_recovery_codes);
    }

    public function test_regenerating_recovery_codes_requires_totp_and_invalidates_old_codes(): void
    {
        [$user, $secret, $old] = $this->mfaUser();

        $this->postJson('/api/v1/profile/2fa/recovery-codes', ['password' => self::PASSWORD, 'code' => $old[0]])
            ->assertStatus(422);

        $new = $this->postJson('/api/v1/profile/2fa/recovery-codes', ['password' => self::PASSWORD, 'code' => $this->otp($secret)])
            ->assertOk()->json('recovery_codes');
        $this->assertCount(8, $new);
        $this->assertEmpty(array_intersect($old, $new));

        $this->app['auth']->forgetGuards();
        $this->login($user, $old[1])->assertStatus(422);
        $this->login($user, $new[0])->assertOk();
    }

    public function test_migration_encrypts_existing_plaintext_secrets_idempotently(): void
    {
        $user = $this->makeUser('staff');
        DB::table('users')->where('id', $user->id)->update(['mfa_secret' => 'JBSWY3DPEHPK3PXP', 'mfa_enabled' => true]);

        $migration = require database_path('migrations/2026_10_27_110000_encrypt_mfa_secrets_and_add_recovery_codes.php');
        $migration->up();
        $once = DB::table('users')->where('id', $user->id)->value('mfa_secret');
        $migration->up();
        $twice = DB::table('users')->where('id', $user->id)->value('mfa_secret');

        $this->assertSame('JBSWY3DPEHPK3PXP', Crypt::decryptString($once));
        $this->assertSame($once, $twice, 'Re-running the migration re-encrypted an encrypted value');
        $this->assertSame('JBSWY3DPEHPK3PXP', $user->fresh()->mfa_secret);
    }
}
