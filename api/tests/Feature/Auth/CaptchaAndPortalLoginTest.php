<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use App\Models\Vendor;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class CaptchaAndPortalLoginTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        config(['captcha.enabled' => true, 'captcha.turnstile_secret' => null]);
    }

    public function test_browser_login_requires_captcha_when_enabled(): void
    {
        $this->makeStaff('staff@portal.test');

        $this->postJson('/api/v1/auth/login', [
            'email'    => 'staff@portal.test',
            'password' => 'Password@123',
            'portal'   => 'staff',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['captcha_token']);
    }

    public function test_browser_login_succeeds_with_issued_captcha_token(): void
    {
        $this->makeStaff('staff@portal.test');
        $token = $this->issueCaptchaToken();

        $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', [
                'email'         => 'staff@portal.test',
                'password'      => 'Password@123',
                'portal'        => 'staff',
                'captcha_token' => $token,
            ])->assertOk()
            ->assertJsonPath('user.email', 'staff@portal.test');
    }

    public function test_captcha_token_cannot_be_reused(): void
    {
        $this->makeStaff('staff@portal.test');
        $token = $this->issueCaptchaToken();

        $this->postJson('/api/v1/auth/login', [
            'email'         => 'staff@portal.test',
            'password'      => 'Password@123',
            'portal'        => 'staff',
            'captcha_token' => $token,
        ])->assertOk();

        $this->postJson('/api/v1/auth/login', [
            'email'         => 'staff@portal.test',
            'password'      => 'Password@123',
            'portal'        => 'staff',
            'captcha_token' => $token,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['captcha_token']);
    }

    public function test_honeypot_rejects_browser_login_even_with_valid_captcha(): void
    {
        $this->makeStaff('staff@portal.test');

        $this->postJson('/api/v1/auth/login', [
            'email'            => 'staff@portal.test',
            'password'         => 'Password@123',
            'portal'           => 'staff',
            'captcha_token'    => $this->issueCaptchaToken(),
            'website_confirm'  => 'http://spam.test',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['captcha_token']);
    }

    public function test_mobile_login_skips_captcha(): void
    {
        $this->makeStaff('staff@portal.test');

        $this->postJson('/api/v1/auth/login', [
            'email'       => 'staff@portal.test',
            'password'    => 'Password@123',
            'client_type' => 'mobile',
            'device_name' => 'mobile',
        ])->assertOk()
            ->assertJsonStructure(['token', 'user']);
    }

    public function test_staff_portal_rejects_supplier_accounts(): void
    {
        $this->makeSupplier('vendor@portal.test');

        $this->postJson('/api/v1/auth/login', [
            'email'         => 'vendor@portal.test',
            'password'      => 'Password@123',
            'portal'        => 'staff',
            'captcha_token' => $this->issueCaptchaToken(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_supplier_portal_rejects_staff_accounts(): void
    {
        $this->makeStaff('staff@portal.test');

        $this->postJson('/api/v1/auth/login', [
            'email'         => 'staff@portal.test',
            'password'      => 'Password@123',
            'portal'        => 'supplier',
            'captcha_token' => $this->issueCaptchaToken(),
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['email']);
    }

    public function test_supplier_portal_login_succeeds_and_skips_employee_setup(): void
    {
        $user = $this->makeSupplier('vendor@portal.test', setupCompleted: false);

        $response = $this->withHeader('Origin', 'http://localhost')
            ->postJson('/api/v1/auth/login', [
                'email'         => 'vendor@portal.test',
                'password'      => 'Password@123',
                'portal'        => 'supplier',
                'captcha_token' => $this->issueCaptchaToken(),
            ]);

        $response->assertOk()
            ->assertJsonPath('user.email', 'vendor@portal.test')
            ->assertJsonPath('user.setup_completed', true)
            ->assertJsonPath('user.vendor_id', $user->vendor_id);
    }

    public function test_captcha_config_endpoint_reports_enabled_driver(): void
    {
        $this->getJson('/api/v1/auth/captcha')
            ->assertOk()
            ->assertJsonPath('enabled', true)
            ->assertJsonPath('driver', 'challenge');
    }

    public function test_turnstile_driver_requires_both_site_and_secret_keys(): void
    {
        config([
            'captcha.enabled' => true,
            'captcha.turnstile_secret' => 'secret-only',
            'captcha.turnstile_site_key' => '',
        ]);

        $this->getJson('/api/v1/auth/captcha')
            ->assertOk()
            ->assertJsonPath('driver', 'challenge')
            ->assertJsonPath('site_key', null);
    }

    private function issueCaptchaToken(): string
    {
        $response = $this->postJson('/api/v1/auth/captcha-challenge');
        $response->assertOk();

        return (string) $response->json('token');
    }

    private function makeStaff(string $email): User
    {
        $user = User::factory()->create([
            'tenant_id'       => $this->tenant->id,
            'email'           => $email,
            'password'        => Hash::make('Password@123'),
            'is_active'       => true,
            'account_status'  => User::STATUS_ACTIVE,
            'setup_completed' => true,
        ]);
        $user->assignRole('staff');

        return $user;
    }

    private function makeSupplier(string $email, bool $setupCompleted = true): User
    {
        $vendor = Vendor::create([
            'tenant_id'   => $this->tenant->id,
            'name'        => 'Portal Supplies',
            'is_approved' => true,
            'is_active'   => true,
            'status'      => 'approved',
        ]);

        $user = User::factory()->create([
            'tenant_id'       => $this->tenant->id,
            'vendor_id'       => $vendor->id,
            'email'           => $email,
            'password'        => Hash::make('Password@123'),
            'is_active'       => true,
            'account_status'  => User::STATUS_ACTIVE,
            'setup_completed' => $setupCompleted,
        ]);
        $user->assignRole('Supplier');

        return $user;
    }
}
