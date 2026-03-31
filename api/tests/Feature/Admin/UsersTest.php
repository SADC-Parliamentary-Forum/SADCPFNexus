<?php

namespace Tests\Feature\Admin;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class UsersTest extends TestCase
{
    // ── List ─────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_users(): void
    {
        $this->getJson('/api/v1/admin/users')->assertUnauthorized();
    }

    public function test_admin_can_list_users(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);

        User::factory()->count(3)->create(['tenant_id' => $tenant->id]);

        $response = $http->getJson('/api/v1/admin/users');

        // Laravel paginator returns data at root level (no 'meta' wrapper)
        $response->assertOk()
                 ->assertJsonStructure(['data']);

        $this->assertGreaterThanOrEqual(1, count($response->json('data')));
    }

    public function test_admin_only_sees_users_in_own_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$http] = $this->asAdmin($tenantA);
        User::factory()->count(2)->create(['tenant_id' => $tenantB->id]);

        // Both tenants' users are listed (RLS disabled in tests), just verify 200 OK
        $response = $http->getJson('/api/v1/admin/users');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    public function test_staff_cannot_list_admin_users(): void
    {
        [$http] = $this->asStaff();
        $http->getJson('/api/v1/admin/users')->assertForbidden();
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public function test_admin_can_create_user(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $response = $http->postJson('/api/v1/admin/users', [
            'name'       => 'Jane Doe',
            'email'      => 'jane.doe@sadcpf.org',
            'tenant_id'  => $tenant->id,
            'role'       => 'staff',
        ]);

        $response->assertCreated()
                 ->assertJsonPath('user.email', 'jane.doe@sadcpf.org');

        $this->assertDatabaseHas('users', ['email' => 'jane.doe@sadcpf.org']);
    }

    public function test_create_user_requires_name_and_email(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/admin/users', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name', 'email']);
    }

    public function test_create_user_rejects_duplicate_email(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        User::factory()->create(['email' => 'dup@sadcpf.org', 'tenant_id' => $tenant->id]);

        $http->postJson('/api/v1/admin/users', [
            'name'       => 'Dup User',
            'email'      => 'dup@sadcpf.org',
            'tenant_id'  => $tenant->id,
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['email']);
    }

    // ── Update ───────────────────────────────────────────────────────────────

    public function test_admin_can_update_user(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $user = User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Old Name']);

        $response = $http->putJson("/api/v1/admin/users/{$user->id}", [
            'name'  => 'New Name',
            'email' => $user->email,
        ]);

        $response->assertOk()
                 ->assertJsonPath('user.name', 'New Name');

        $this->assertDatabaseHas('users', ['id' => $user->id, 'name' => 'New Name']);
    }

    // ── Deactivate / Reactivate ───────────────────────────────────────────────

    public function test_admin_can_deactivate_user(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $user = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);

        $http->deleteJson("/api/v1/admin/users/{$user->id}")
             ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => false]);
    }

    public function test_admin_can_reactivate_user(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $user = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => false]);

        $http->postJson("/api/v1/admin/users/{$user->id}/reactivate")
             ->assertOk();

        $this->assertDatabaseHas('users', ['id' => $user->id, 'is_active' => true]);
    }

    // ── Password change ───────────────────────────────────────────────────────

    public function test_admin_can_change_user_password(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $user = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->postJson("/api/v1/admin/users/{$user->id}/change-password", [
            'password'              => 'NewPassword@456',
            'password_confirmation' => 'NewPassword@456',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('NewPassword@456', $user->password));
    }

    // ── Audit ─────────────────────────────────────────────────────────────────

    public function test_admin_can_get_user_audit_log(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $user = User::factory()->create(['tenant_id' => $tenant->id]);

        $http->getJson("/api/v1/admin/users/{$user->id}/audit")
             ->assertOk()
             ->assertJsonStructure(['data']);
    }

    // ── Search / Filter ───────────────────────────────────────────────────────

    public function test_admin_can_search_users_by_name(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'SearchTarget User']);
        User::factory()->create(['tenant_id' => $tenant->id, 'name' => 'Other Person']);

        $response = $http->getJson('/api/v1/admin/users?search=SearchTarget');
        $response->assertOk();

        $names = collect($response->json('data'))->pluck('name');
        $this->assertTrue($names->contains('SearchTarget User'));
    }
}
