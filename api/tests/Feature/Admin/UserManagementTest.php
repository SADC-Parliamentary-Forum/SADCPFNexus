<?php

namespace Tests\Feature\Admin;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UserManagementTest extends TestCase
{
    use RefreshDatabase;

    private Tenant $tenant;
    private User $admin;
    private User $staffUser;

    protected function setUp(): void
    {
        parent::setUp();

        // Seed roles
        $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

        $this->tenant = Tenant::factory()->create();

        $this->admin = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->admin->assignRole('System Admin');

        $this->staffUser = User::factory()->create([
            'tenant_id' => $this->tenant->id,
            'is_active' => true,
        ]);
        $this->staffUser->assignRole('Staff');
    }

    public function test_admin_can_list_users(): void
    {
        $response = $this->actingAs($this->admin)->getJson('/api/v1/admin/users');
        $response->assertStatus(200)->assertJsonStructure(['data', 'current_page']);
    }

    public function test_staff_cannot_list_users(): void
    {
        $response = $this->actingAs($this->staffUser)->getJson('/api/v1/admin/users');
        $response->assertStatus(403);
    }

    public function test_admin_can_create_user(): void
    {
        $response = $this->actingAs($this->admin)->postJson('/api/v1/admin/users', [
            'name'  => 'New Staff Member',
            'email' => 'newstaff@sadcpf.org',
            'role'  => 'Staff',
        ]);

        $response->assertStatus(201)->assertJsonStructure(['message', 'user']);
        $this->assertDatabaseHas('users', ['email' => 'newstaff@sadcpf.org']);
    }

    public function test_admin_can_deactivate_user(): void
    {
        $target = User::factory()->create(['tenant_id' => $this->tenant->id, 'is_active' => true]);

        $response = $this->actingAs($this->admin)->deleteJson("/api/v1/admin/users/{$target->id}");
        $response->assertStatus(200);
        $this->assertDatabaseHas('users', ['id' => $target->id, 'is_active' => false]);
    }

    public function test_rls_cross_tenant_isolation(): void
    {
        // User from a different tenant
        $otherTenant = Tenant::factory()->create();
        $otherUser = User::factory()->create([
            'tenant_id' => $otherTenant->id,
            'is_active' => true,
        ]);

        // Admin from first tenant should not see users from other tenant
        $response = $this->actingAs($this->admin)->getJson('/api/v1/admin/users');
        $response->assertStatus(200);

        $ids = collect($response->json('data'))->pluck('id');
        $this->assertNotContains($otherUser->id, $ids->toArray());
    }

    public function test_admin_can_view_user_audit_trail(): void
    {
        $response = $this->actingAs($this->admin)->getJson("/api/v1/admin/users/{$this->staffUser->id}/audit");
        $response->assertStatus(200)->assertJsonStructure(['data']);
    }
}
