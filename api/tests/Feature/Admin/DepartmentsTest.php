<?php

namespace Tests\Feature\Admin;

use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class DepartmentsTest extends TestCase
{
    // ── List ─────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_departments(): void
    {
        $this->getJson('/api/v1/admin/departments')->assertUnauthorized();
    }

    public function test_authenticated_user_can_list_departments(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $this->makeDepartment($tenant);
        $this->makeDepartment($tenant);

        $response = $http->getJson('/api/v1/admin/departments');

        $response->assertOk()
                 ->assertJsonStructure(['data']);

        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_user_only_sees_departments_in_own_tenant(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$http] = $this->asStaff($tenantA);
        $this->makeDepartment($tenantA);
        $this->makeDepartment($tenantB);

        $response = $http->getJson('/api/v1/admin/departments');
        $response->assertOk();

        $tenantIds = collect($response->json('data'))->pluck('tenant_id')->unique()->values()->toArray();
        $this->assertNotContains($tenantB->id, $tenantIds);
    }

    // ── Create ───────────────────────────────────────────────────────────────

    public function test_admin_can_create_department(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $response = $http->postJson('/api/v1/admin/departments', [
            'name' => 'Programme Management',
            'code' => 'PM',
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.name', 'Programme Management')
                 ->assertJsonPath('data.code', 'PM');

        $this->assertDatabaseHas('departments', ['name' => 'Programme Management', 'code' => 'PM']);
    }

    public function test_create_department_requires_name_and_code(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/admin/departments', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name', 'code']);
    }

    public function test_admin_can_create_child_department(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $parent = $this->makeDepartment($tenant);

        $response = $http->postJson('/api/v1/admin/departments', [
            'name'      => 'Sub Unit',
            'code'      => 'SUB',
            'parent_id' => $parent->id,
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.parent_id', $parent->id);
    }

    public function test_staff_cannot_create_department(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/admin/departments', [
            'name' => 'Illegal Dept',
            'code' => 'ILL',
        ])->assertForbidden();
    }

    // ── Show ─────────────────────────────────────────────────────────────────

    public function test_admin_can_show_department(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $dept = $this->makeDepartment($tenant);

        $response = $http->getJson("/api/v1/admin/departments/{$dept->id}");
        $response->assertOk()
                 ->assertJsonPath('data.id', $dept->id);
    }

    // ── Update ───────────────────────────────────────────────────────────────

    public function test_admin_can_update_department(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $dept = $this->makeDepartment($tenant);

        $response = $http->putJson("/api/v1/admin/departments/{$dept->id}", [
            'name' => 'Updated Name',
            'code' => 'UPD',
        ]);

        $response->assertOk()
                 ->assertJsonPath('data.name', 'Updated Name');

        $this->assertDatabaseHas('departments', ['id' => $dept->id, 'name' => 'Updated Name']);
    }

    public function test_admin_can_reparent_department(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $parent = $this->makeDepartment($tenant);
        $child  = $this->makeDepartment($tenant);

        $response = $http->putJson("/api/v1/admin/departments/{$child->id}", [
            'name'      => $child->name,
            'code'      => $child->code,
            'parent_id' => $parent->id,
        ]);

        $response->assertOk()
                 ->assertJsonPath('data.parent_id', $parent->id);
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    public function test_admin_can_delete_empty_department(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $dept = $this->makeDepartment($tenant);

        $http->deleteJson("/api/v1/admin/departments/{$dept->id}")
             ->assertOk();

        $this->assertDatabaseMissing('departments', ['id' => $dept->id]);
    }

    public function test_returns_404_for_nonexistent_department(): void
    {
        [$http] = $this->asAdmin();

        $http->getJson('/api/v1/admin/departments/99999')
             ->assertNotFound();
    }
}
