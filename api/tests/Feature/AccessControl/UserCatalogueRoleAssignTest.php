<?php

namespace Tests\Feature\AccessControl;

use App\Models\AccessControl\AccessRoleCatalogue;
use App\Models\AccessControl\AccessRoleVersion;
use App\Models\Tenant;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class UserCatalogueRoleAssignTest extends TestCase
{
    public function test_publish_creates_spatie_role_with_catalogue_permissions(): void
    {
        $admin = $this->makeUser('System Admin');
        $catalogue = $this->makeUnaroCatalogue($admin->tenant_id, $admin->id, 'medium');

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/access/roles/{$catalogue->id}/publish", [
            'permissions' => ['admin.roles.view'],
            'changelog' => 'Published Unaro Role for assignment',
        ])
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $this->assertNotNull(Role::findByName('Unaro Role', 'sanctum'));
        $this->assertNotNull(Role::findByName('Unaro Role', 'web'));
        $this->assertTrue(Role::findByName('Unaro Role', 'sanctum')->hasPermissionTo('admin.roles.view'));
    }

    public function test_admin_can_assign_published_unaro_role_via_http(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);
        $version = $this->publishUnaro($tenant->id, $admin->id, 'medium', ['admin.roles.view']);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/access/users/{$target->id}/role-versions/{$version->id}", [
            'reason' => 'Assigned from user security tab',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'active');

        $fresh = $target->fresh();
        $this->assertTrue($fresh->hasRole('Unaro Role'));
        $this->assertTrue($fresh->checkPermissionTo('admin.roles.view'));

        $profile = $this->getJson("/api/v1/admin/access/users/{$target->id}/profile")
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'role_assignments',
                    'pending_role_sync_requests',
                ],
            ])
            ->json('data');

        $names = collect($profile['role_assignments'])
            ->map(fn ($row) => $row['role_version']['catalogue']['name'] ?? null)
            ->all();
        $this->assertContains('Unaro Role', $names);
        $this->assertIsArray($profile['pending_role_sync_requests']);
    }

    public function test_high_risk_catalogue_assignment_stays_pending_until_second_admin_approves(): void
    {
        $tenant = Tenant::factory()->create();
        $adminA = $this->makeUser('System Admin', $tenant);
        $adminB = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);
        $version = $this->publishUnaro($tenant->id, $adminA->id, 'high', ['admin.roles.view']);

        Sanctum::actingAs($adminA);
        $assignmentId = $this->postJson("/api/v1/admin/access/users/{$target->id}/role-versions/{$version->id}", [
            'reason' => 'Privileged Unaro assignment',
        ])
            ->assertCreated()
            ->assertJsonPath('data.status', 'pending_approval')
            ->json('data.id');

        $this->assertFalse($target->fresh()->hasRole('Unaro Role'));
        $this->assertFalse($target->fresh()->checkPermissionTo('admin.roles.view'));

        $this->postJson("/api/v1/admin/access/role-assignments/{$assignmentId}/approve")
            ->assertStatus(422);

        Sanctum::actingAs($adminB);
        $this->postJson("/api/v1/admin/access/role-assignments/{$assignmentId}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'active');

        $fresh = $target->fresh();
        $this->assertTrue($fresh->hasRole('Unaro Role'));
        $this->assertTrue($fresh->checkPermissionTo('admin.roles.view'));
    }

    public function test_profile_includes_pending_spatie_role_sync_requests(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);

        Sanctum::actingAs($admin);
        $requestId = $this->patchJson("/api/v1/admin/users/{$target->id}/roles", [
            'roles' => ['HOD'],
        ])
            ->assertStatus(202)
            ->json('data.request_id');

        $pending = $this->getJson("/api/v1/admin/access/users/{$target->id}/profile")
            ->assertOk()
            ->json('data.pending_role_sync_requests');

        $this->assertNotEmpty($pending);
        $this->assertSame($requestId, $pending[0]['id']);
        $this->assertSame('pending_approval', $pending[0]['status']);
        $this->assertSame($admin->id, $pending[0]['requested_by']);
        $this->assertContains('HOD', $pending[0]['roles']);
    }

    /**
     * @param  list<string>  $permissions
     */
    private function publishUnaro(int $tenantId, int $ownerId, string $risk, array $permissions): AccessRoleVersion
    {
        $catalogue = $this->makeUnaroCatalogue($tenantId, $ownerId, $risk);
        $admin = \App\Models\User::query()->findOrFail($ownerId);

        return app(\App\Modules\AccessControl\Services\RoleCatalogueService::class)
            ->publishVersion($catalogue, $permissions, $admin, 'Published for assignment tests')
            ->fresh(['catalogue']);
    }

    private function makeUnaroCatalogue(int $tenantId, int $ownerId, string $risk): AccessRoleCatalogue
    {
        return AccessRoleCatalogue::create([
            'tenant_id' => $tenantId,
            'key' => 'unaro_role_'.uniqid(),
            'name' => 'Unaro Role',
            'owner_user_id' => $ownerId,
            'status' => 'draft',
            'risk_level' => $risk,
            'default_scopes' => ['organisation'],
        ]);
    }
}
