<?php

namespace Tests\Feature\Admin;

use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class UsersBulkDeactivateTest extends TestCase
{
    public function test_unauthenticated_cannot_bulk_deactivate(): void
    {
        $this->postJson('/api/v1/admin/users/bulk-deactivate', [
            'ids' => [1],
        ])->assertUnauthorized();
    }

    public function test_staff_cannot_bulk_deactivate(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $target = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);

        $http->postJson('/api/v1/admin/users/bulk-deactivate', [
            'ids' => [$target->id],
        ])->assertForbidden();
    }

    public function test_admin_can_bulk_deactivate_users(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $a = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);
        $b = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);

        $response = $http->postJson('/api/v1/admin/users/bulk-deactivate', [
            'ids' => [$a->id, $b->id],
        ]);

        $response->assertOk()
            ->assertJsonPath('deactivated_count', 2)
            ->assertJsonPath('skipped_count', 0);

        $this->assertDatabaseHas('users', ['id' => $a->id, 'is_active' => false]);
        $this->assertDatabaseHas('users', ['id' => $b->id, 'is_active' => false]);
    }

    public function test_bulk_deactivate_skips_self(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);

        $other = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);

        $response = $http->postJson('/api/v1/admin/users/bulk-deactivate', [
            'ids' => [$admin->id, $other->id],
        ]);

        $response->assertOk()
            ->assertJsonPath('deactivated_count', 1)
            ->assertJsonPath('skipped_count', 1);

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
        $this->assertDatabaseHas('users', ['id' => $other->id, 'is_active' => false]);

        $skipped = collect($response->json('skipped'));
        $this->assertTrue($skipped->contains(fn ($row) => $row['id'] === $admin->id));
    }

    public function test_bulk_deactivate_skips_system_admin_targets(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $otherAdmin = $this->makeAdmin($tenant);
        $staff = User::factory()->create(['tenant_id' => $tenant->id, 'is_active' => true]);

        $response = $http->postJson('/api/v1/admin/users/bulk-deactivate', [
            'ids' => [$otherAdmin->id, $staff->id],
        ]);

        $response->assertOk()
            ->assertJsonPath('deactivated_count', 1)
            ->assertJsonPath('skipped_count', 1);

        $this->assertDatabaseHas('users', ['id' => $otherAdmin->id, 'is_active' => true]);
        $this->assertDatabaseHas('users', ['id' => $staff->id, 'is_active' => false]);
    }

    public function test_bulk_deactivate_requires_ids_array(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/admin/users/bulk-deactivate', [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['ids']);
    }

    public function test_single_deactivate_rejects_self(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);

        $http->deleteJson("/api/v1/admin/users/{$admin->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $admin->id, 'is_active' => true]);
    }

    public function test_single_deactivate_rejects_system_admin_target(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $otherAdmin = $this->makeAdmin($tenant);

        $http->deleteJson("/api/v1/admin/users/{$otherAdmin->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('users', ['id' => $otherAdmin->id, 'is_active' => true]);
    }
}
