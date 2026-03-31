<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthTest extends TestCase
{
    private Tenant $tenant;
    private User   $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->tenant = Tenant::factory()->create();
        $this->user   = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'email'     => 'test@sadcpf.org',
            'password'  => Hash::make('Password@123'),
            'is_active' => true,
        ]);
        $this->user->assignRole('staff');
    }

    public function test_login_returns_token_for_valid_credentials(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'test@sadcpf.org',
            'password' => 'Password@123',
        ]);

        $response->assertOk()
                 ->assertJsonStructure([
                     'token',
                     'user' => ['id', 'name', 'email', 'tenant_id', 'roles', 'permissions'],
                 ]);

        $this->assertNotEmpty($response->json('token'));
    }

    public function test_login_rejects_wrong_password(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'test@sadcpf.org',
            'password' => 'WrongPassword!',
        ]);

        $response->assertUnprocessable();
        $response->assertJsonValidationErrors(['email']);
    }

    public function test_login_rejects_unknown_email(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'    => 'nobody@example.com',
            'password' => 'Password@123',
        ]);

        $response->assertUnprocessable();
    }

    public function test_me_returns_authenticated_user(): void
    {
        $response = $this->asUser($this->user)->getJson('/api/v1/auth/me');

        $response->assertOk()
                 ->assertJsonPath('id', $this->user->id)
                 ->assertJsonPath('email', $this->user->email);
    }

    public function test_protected_endpoint_rejects_unauthenticated_request(): void
    {
        $this->getJson('/api/v1/auth/me')->assertUnauthorized();
    }

    public function test_logout_revokes_token(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;

        $this->withHeader('Authorization', "Bearer {$token}")
             ->postJson('/api/v1/auth/logout')
             ->assertOk();

        // Token must be deleted from the database (revoked)
        $this->assertDatabaseCount('personal_access_tokens', 0);
    }

    public function test_login_requires_email_and_password(): void
    {
        $this->postJson('/api/v1/auth/login', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['email', 'password']);
    }

    public function test_inactive_user_cannot_login(): void
    {
        $this->user->update(['is_active' => false]);

        $this->postJson('/api/v1/auth/login', [
            'email'    => 'test@sadcpf.org',
            'password' => 'Password@123',
        ])->assertUnprocessable();
    }
}
