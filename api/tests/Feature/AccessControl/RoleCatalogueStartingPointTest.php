<?php

namespace Tests\Feature\AccessControl;

use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class RoleCatalogueStartingPointTest extends TestCase
{
    public function test_catalogue_payload_includes_version_permissions_for_starting_point(): void
    {
        $admin = $this->makeUser('System Admin');
        Sanctum::actingAs($admin);

        $roles = $this->getJson('/api/v1/admin/access/roles')
            ->assertOk()
            ->json('data');

        $this->assertIsArray($roles);
        $this->assertNotEmpty($roles);

        $general = collect($roles)->firstWhere('name', 'General Employee');
        $this->assertIsArray($general, 'General Employee must appear in the governed catalogue.');

        $this->assertArrayHasKey('current_version', $general);
        $this->assertArrayHasKey('latest_version', $general);

        $permissions = $general['current_version']['permissions']
            ?? $general['latest_version']['permissions']
            ?? null;

        $this->assertIsArray($permissions);
        $this->assertNotEmpty($permissions);
        $this->assertContains('leave.view', $permissions);

        foreach ($roles as $role) {
            $this->assertArrayNotHasKey('currentVersion', $role);
            $this->assertArrayNotHasKey('latestVersion', $role);
        }
    }

    public function test_catalogue_current_version_is_highest_active_when_older_versions_exist(): void
    {
        $admin = $this->makeUser('System Admin');
        $catalogue = \App\Models\AccessControl\AccessRoleCatalogue::query()
            ->where('name', 'General Employee')
            ->firstOrFail();

        $catalogue->versions()->where('status', 'active')->update(['status' => 'retired']);
        \App\Models\AccessControl\AccessRoleVersion::create([
            'role_catalogue_id' => $catalogue->id,
            'version' => ((int) $catalogue->versions()->max('version')) + 1,
            'status' => 'active',
            'permissions' => ['leave.view', 'assets.create'],
            'changelog' => 'Newer published starting point',
            'published_at' => now(),
        ]);

        Sanctum::actingAs($admin);
        $general = collect($this->getJson('/api/v1/admin/access/roles')->assertOk()->json('data'))
            ->firstWhere('name', 'General Employee');

        $this->assertContains('assets.create', $general['current_version']['permissions']);
        $this->assertSame('active', $general['current_version']['status']);
        $this->assertGreaterThan(1, (int) $general['current_version']['version']);
    }
}
