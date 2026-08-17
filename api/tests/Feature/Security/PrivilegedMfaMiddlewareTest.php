<?php

namespace Tests\Feature\Security;

use App\Models\Tenant;
use Tests\TestCase;

/**
 * MFA gate must not break PHPUnit / local Feature suites.
 */
class PrivilegedMfaMiddlewareTest extends TestCase
{
    public function test_privileged_user_without_mfa_can_call_api_in_testing(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->forceFill(['mfa_enabled' => false])->save();

        $this->asUser($admin)
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }

    public function test_require_privileged_mfa_defaults_off_outside_production(): void
    {
        $this->assertFalse((bool) config('auth.require_privileged_mfa'));
        $this->assertFalse((bool) config('auth.enforce_privileged_mfa_in_tests'));
    }

    public function test_privileged_user_without_mfa_is_blocked_when_enforced(): void
    {
        config([
            'auth.require_privileged_mfa' => true,
            'auth.enforce_privileged_mfa_in_tests' => true,
        ]);

        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $admin->forceFill(['mfa_enabled' => false])->save();

        $this->asUser($admin)
            ->getJson('/api/v1/auth/me')
            ->assertOk();

        $this->asUser($admin)
            ->getJson('/api/v1/profile')
            ->assertForbidden()
            ->assertJsonPath('mfa_setup_required', true);
    }
}
