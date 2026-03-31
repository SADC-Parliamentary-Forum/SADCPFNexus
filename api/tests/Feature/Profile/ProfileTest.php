<?php

namespace Tests\Feature\Profile;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class ProfileTest extends TestCase
{
    public function test_unauthenticated_cannot_get_profile(): void
    {
        $this->getJson('/api/v1/profile')->assertUnauthorized();
    }

    public function test_authenticated_user_can_get_own_profile(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->getJson('/api/v1/profile');

        $response->assertOk()
                 ->assertJsonPath('id', $user->id)
                 ->assertJsonPath('email', $user->email);
    }

    public function test_user_can_update_own_profile(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->putJson('/api/v1/profile', [
            'name'  => 'Updated Full Name',
            'phone' => '+264 81 123456',
        ]);

        $response->assertOk()
                 ->assertJsonPath('name', 'Updated Full Name');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'Updated Full Name']);
    }

    public function test_user_can_change_own_password(): void
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'password'  => Hash::make('OldPassword@123'),
        ]);
        $user->assignRole('staff');

        $response = $this->asUser($user)->putJson('/api/v1/profile/password', [
            'current_password'      => 'OldPassword@123',
            'password'              => 'NewPassword@456',
            'password_confirmation' => 'NewPassword@456',
        ]);

        $response->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword@456', $user->password));
    }

    public function test_password_change_rejects_wrong_current_password(): void
    {
        $tenant = Tenant::factory()->create();
        $user = User::factory()->create([
            'tenant_id' => $tenant->id,
            'password'  => Hash::make('OldPassword@123'),
        ]);
        $user->assignRole('staff');

        $this->asUser($user)->putJson('/api/v1/profile/password', [
            'current_password'      => 'WrongCurrent!',
            'password'              => 'NewPassword@456',
            'password_confirmation' => 'NewPassword@456',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['current_password']);
    }

    public function test_password_change_requires_confirmation_match(): void
    {
        [$http] = $this->asStaff();

        $http->putJson('/api/v1/profile/password', [
            'current_password'      => 'anything',
            'password'              => 'NewPassword@456',
            'password_confirmation' => 'DifferentPassword@456',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['password']);
    }

    public function test_profile_update_requires_name(): void
    {
        [$http] = $this->asStaff();

        $http->putJson('/api/v1/profile', ['name' => ''])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name']);
    }

    // ── Profile change requests ───────────────────────────────────────────────

    public function test_user_can_submit_profile_change_request(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/profile/change-request', [
            'changes' => [
                'phone' => '+264 81 999888',
            ],
            'reason' => 'Updated phone number',
        ]);

        $response->assertCreated()
                 ->assertJsonStructure(['data' => ['id', 'status']]);
    }

    public function test_user_can_cancel_pending_change_request(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/profile/change-request', [
            'changes' => ['phone' => '+264 81 000111'],
            'reason'  => 'Test request',
        ]);
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/profile/change-request/{$id}")
             ->assertOk();
    }
}
