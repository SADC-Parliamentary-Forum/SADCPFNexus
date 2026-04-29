<?php

namespace Tests\Feature\Auth;

use App\Models\Tenant;
use App\Models\User;
use App\Models\UserSession;
use Illuminate\Support\Facades\Hash;
use Laravel\Sanctum\PersonalAccessToken;
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

    public function test_browser_login_returns_session_for_valid_credentials(): void
    {
        // Sanctum only enables session middleware when Origin / Referer looks like the SPA ("stateful").
        $origin = config('app.url');
        $response = $this->withHeader('Origin', is_string($origin) ? rtrim($origin, '/') : 'http://localhost')->postJson('/api/v1/auth/login', [
            'email'    => 'test@sadcpf.org',
            'password' => 'Password@123',
        ]);

        $response->assertOk()
                 ->assertJsonStructure([
                     'user' => ['id', 'name', 'email', 'tenant_id', 'roles', 'permissions'],
                 ]);
        $response->assertCookie(config('session.cookie'));
        $this->assertNull($response->json('token'));
    }

    public function test_mobile_login_returns_token_for_valid_credentials(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'       => 'test@sadcpf.org',
            'password'    => 'Password@123',
            'client_type' => 'mobile',
            'device_name' => 'mobile',
        ]);

        $response->assertOk()
                 ->assertJsonStructure([
                     'token',
                     'user' => ['id', 'name', 'email', 'tenant_id', 'roles', 'permissions'],
                 ]);

        $this->assertNotEmpty($response->json('token'));
    }

    public function test_mobile_login_tracks_user_session_for_token(): void
    {
        $response = $this->postJson('/api/v1/auth/login', [
            'email'       => 'test@sadcpf.org',
            'password'    => 'Password@123',
            'client_type' => 'mobile',
            'device_name' => 'mobile',
        ]);

        $response->assertOk();
        $plainTextToken = (string) $response->json('token');
        $token = PersonalAccessToken::findToken($plainTextToken);

        $this->assertNotNull($token);
        $this->assertDatabaseHas('user_sessions', [
            'user_id' => $this->user->id,
            'token_id' => $token->id,
            'auth_type' => 'token',
        ]);
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
        $currentToken = PersonalAccessToken::findToken($token);

        UserSession::create([
            'user_id' => $this->user->id,
            'token_id' => $currentToken->id,
            'session_id' => null,
            'auth_type' => 'token',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'last_active_at' => now(),
        ]);

        $this->withHeader('Authorization', "Bearer {$token}")
             ->postJson('/api/v1/auth/logout')
             ->assertOk();

        // Token must be deleted from the database (revoked)
        $this->assertDatabaseCount('personal_access_tokens', 0);
        $this->assertDatabaseMissing('user_sessions', [
            'user_id' => $this->user->id,
            'token_id' => $currentToken->id,
            'auth_type' => 'token',
        ]);
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

    public function test_inactive_user_request_revokes_active_token_session(): void
    {
        $token = $this->user->createToken('test')->plainTextToken;
        $currentToken = PersonalAccessToken::findToken($token);

        UserSession::create([
            'user_id' => $this->user->id,
            'token_id' => $currentToken->id,
            'session_id' => null,
            'auth_type' => 'token',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'last_active_at' => now(),
        ]);

        $this->user->update(['is_active' => false]);

        $this->withHeader('Authorization', "Bearer {$token}")
            ->getJson('/api/v1/auth/me')
            ->assertStatus(403)
            ->assertJsonPath('message', 'This account has been deactivated.');

        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $currentToken->id,
        ]);
        $this->assertDatabaseMissing('user_sessions', [
            'user_id' => $this->user->id,
            'token_id' => $currentToken->id,
            'auth_type' => 'token',
        ]);
    }

    public function test_force_reset_password_revokes_other_token_sessions_only(): void
    {
        $this->user->update(['must_reset_password' => true]);

        $currentPlainToken = $this->user->createToken('current')->plainTextToken;
        $otherPlainToken = $this->user->createToken('other')->plainTextToken;
        $currentToken = PersonalAccessToken::findToken($currentPlainToken);
        $otherToken = PersonalAccessToken::findToken($otherPlainToken);

        UserSession::create([
            'user_id' => $this->user->id,
            'token_id' => $currentToken->id,
            'session_id' => null,
            'auth_type' => 'token',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'last_active_at' => now(),
        ]);
        UserSession::create([
            'user_id' => $this->user->id,
            'token_id' => $otherToken->id,
            'session_id' => null,
            'auth_type' => 'token',
            'ip_address' => '127.0.0.1',
            'user_agent' => 'PHPUnit',
            'last_active_at' => now(),
        ]);

        $this->withHeader('Authorization', "Bearer {$currentPlainToken}")
            ->postJson('/api/v1/auth/force-reset-password', [
                'password' => 'NewPassword@123',
                'password_confirmation' => 'NewPassword@123',
            ])->assertOk();

        $this->assertDatabaseHas('personal_access_tokens', [
            'id' => $currentToken->id,
        ]);
        $this->assertDatabaseMissing('personal_access_tokens', [
            'id' => $otherToken->id,
        ]);
        $this->assertDatabaseHas('user_sessions', [
            'user_id' => $this->user->id,
            'token_id' => $currentToken->id,
            'auth_type' => 'token',
        ]);
        $this->assertDatabaseMissing('user_sessions', [
            'user_id' => $this->user->id,
            'token_id' => $otherToken->id,
            'auth_type' => 'token',
        ]);
    }
}
