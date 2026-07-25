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
        $this->assertFalse(filter_var(
            env('REQUIRE_PRIVILEGED_MFA', 'false'),
            FILTER_VALIDATE_BOOLEAN
        ));
    }
}
