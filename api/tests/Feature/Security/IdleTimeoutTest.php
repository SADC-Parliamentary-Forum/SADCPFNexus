<?php

namespace Tests\Feature\Security;

use App\Models\Tenant;
use App\Models\UserSession;
use Laravel\Sanctum\PersonalAccessToken;
use Tests\TestCase;

class IdleTimeoutTest extends TestCase
{
    public function test_profile_exposes_and_updates_idle_timeout_minutes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $http->getJson('/api/v1/profile')
            ->assertOk()
            ->assertJsonPath('idle_timeout_minutes', null);

        $http->patchJson('/api/v1/profile/idle-timeout', [
            'idle_timeout_minutes' => 15,
        ])->assertOk()
            ->assertJsonPath('data.idle_timeout_minutes', 15);

        $this->assertSame(15, $user->fresh()->idle_timeout_minutes);

        $http->patchJson('/api/v1/profile/idle-timeout', [
            'idle_timeout_minutes' => 7,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['idle_timeout_minutes']);
    }

    public function test_idle_token_is_rejected_after_configured_timeout(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->forceFill(['idle_timeout_minutes' => 15])->save();

        $plain = $user->createToken('idle-test')->plainTextToken;
        $token = PersonalAccessToken::findToken($plain);
        $this->assertNotNull($token);

        UserSession::create([
            'user_id'        => $user->id,
            'token_id'       => $token->id,
            'auth_type'      => 'token',
            'ip_address'     => '127.0.0.1',
            'user_agent'     => 'phpunit',
            'last_active_at' => now()->subMinutes(16),
        ]);

        $this->withHeader('Authorization', "Bearer {$plain}")
            ->getJson('/api/v1/auth/me')
            ->assertUnauthorized()
            ->assertJsonPath('code', 'session_idle_timeout');

        $this->assertDatabaseMissing('personal_access_tokens', ['id' => $token->id]);
    }

    public function test_zero_idle_timeout_never_expires_for_inactivity(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('staff', $tenant);
        $user->forceFill(['idle_timeout_minutes' => 0])->save();

        $plain = $user->createToken('idle-never')->plainTextToken;
        $token = PersonalAccessToken::findToken($plain);
        $this->assertNotNull($token);

        UserSession::create([
            'user_id'        => $user->id,
            'token_id'       => $token->id,
            'auth_type'      => 'token',
            'ip_address'     => '127.0.0.1',
            'user_agent'     => 'phpunit',
            'last_active_at' => now()->subHours(12),
            'session_id'     => null,
        ]);

        $this->withHeader('Authorization', "Bearer {$plain}")
            ->getJson('/api/v1/auth/me')
            ->assertOk();
    }
}
