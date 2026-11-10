<?php

namespace Tests\Feature\AccessControl;

use App\Models\AccessControl\AccessRoleCatalogue;
use App\Models\AccessControl\AccessRoleSyncRequest;
use App\Models\AccessControl\AccessRoleVersion;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\AccessControl\Services\RoleCatalogueService;
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

    public function test_system_admin_assigns_a_high_risk_catalogue_role_directly(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $target = $this->makeUser('staff', $tenant);
        $version = $this->publishUnaro($tenant->id, $admin->id, 'high', ['admin.roles.view']);

        Sanctum::actingAs($admin);
        $this->postJson("/api/v1/admin/access/users/{$target->id}/role-versions/{$version->id}", [
            'reason' => 'Privileged Unaro assignment',
        ])
            ->assertCreated()
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

        $requestId = AccessRoleSyncRequest::query()->create([
            'tenant_id' => $tenant->id,
            'user_id' => $target->id,
            'roles' => ['HOD'],
            'requested_by' => $admin->id,
            'status' => 'pending_approval',
            'reason' => 'Role assignment requires dual control.',
        ])->id;
        Sanctum::actingAs($admin);

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
        $admin = User::query()->findOrFail($ownerId);

        return app(RoleCatalogueService::class)
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
