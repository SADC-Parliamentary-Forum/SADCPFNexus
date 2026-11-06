<?php

namespace Tests\Feature\AccessControl;

use App\Models\AccessControl\AccessRoleSyncRequest;
use App\Models\Tenant;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class RolesCleanupTest extends TestCase
{
    public function test_role_list_offers_one_admin_role_and_the_catalogue(): void
    {
        foreach (['System Administrator', 'admin', 'Admin'] as $name) {
            Role::findOrCreate($name, 'sanctum');
        }
        Sanctum::actingAs($this->makeAdmin());

        $response = $this->getJson('/api/v1/admin/roles')->assertOk();
        $names = collect($response->json('roles'))->pluck('name');

        $this->assertContains('System Admin', $names);
        $this->assertContains('General Employee', $names);
        foreach (['System Administrator', 'admin', 'Admin', 'super-admin', 'staff', 'Finance Controller'] as $hidden) {
            $this->assertNotContains($hidden, $names);
        }
        $this->assertSame(['Finance Controller'], $response->json('aliases')['Finance Officer']);
    }

    public function test_dry_run_reports_without_changing_anything(): void
    {
        $user = $this->makeUser('Staff');

        $this->artisan('roles:cleanup')
            ->expectsOutputToContain("user {$user->id}: Staff  ->  General Employee + staff + Staff")
            ->assertSuccessful();

        $this->assertSame(['Staff'], $user->fresh()->getRoleNames()->all());
    }

    public function test_apply_moves_old_role_names_to_the_catalogue_and_keeps_their_aliases(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('Staff', $tenant);
        $controller = $this->makeUser('Finance Controller', $tenant);
        $hr = $this->makeUser('HR Administrator', $tenant);
        $governance = $this->makeUser('Governance Officer', $tenant);
        $governance->assignRole('staff');
        $officer = $this->makeUser('Finance Officer', $tenant);
        Role::findOrCreate('Human Resource, Admin and Procurement Officer', 'sanctum');
        $combined = $this->makeUser('Human Resource, Admin and Procurement Officer', $tenant);
        Role::findOrCreate('Admin', 'sanctum');
        Role::findOrCreate('Admin', 'web');

        $this->artisan('roles:cleanup', ['--apply' => true])->assertSuccessful();

        $this->assertEqualsCanonicalizing(['General Employee', 'staff', 'Staff'], $staff->fresh()->getRoleNames()->all());
        $this->assertEqualsCanonicalizing(['Finance Officer', 'Finance Controller'], $controller->fresh()->getRoleNames()->all());
        $this->assertEqualsCanonicalizing(
            ['HR and Administration Officer', 'HR Manager', 'HR Administrator', 'Administration Officer'],
            $hr->fresh()->getRoleNames()->all()
        );
        $this->assertEqualsCanonicalizing(
            ['Governance Officer', 'General Employee', 'staff', 'Staff'],
            $governance->fresh()->getRoleNames()->all()
        );
        $this->assertSame(['Finance Officer'], $officer->fresh()->getRoleNames()->all());
        $this->assertEqualsCanonicalizing(
            ['HR and Administration Officer', 'HR Manager', 'HR Administrator', 'Administration Officer', 'Procurement Officer'],
            $combined->fresh()->getRoleNames()->all()
        );

        $this->assertFalse(Role::where('name', 'Human Resource, Admin and Procurement Officer')->exists());
        $this->assertFalse(Role::where('name', 'Admin')->exists());
        $this->assertTrue(Role::where('name', 'super-admin')->exists());
        $this->assertDatabaseHas('audit_logs', ['event' => 'user.role_changed', 'auditable_id' => $staff->id]);

        $this->artisan('roles:cleanup')->expectsOutputToContain('0 user(s) to move.')->assertSuccessful();
    }

    public function test_retired_role_still_held_by_someone_is_not_deleted(): void
    {
        Role::findOrCreate('admin', 'web');
        $user = $this->makeUser('Field Researcher');
        $user->roles()->attach(Role::findByName('admin', 'web'));

        $this->artisan('roles:cleanup', ['--apply' => true])->assertSuccessful();

        $this->assertTrue(Role::where('name', 'admin')->where('guard_name', 'web')->exists());
    }

    public function test_adding_a_role_on_the_user_page_brings_its_aliases_and_removing_it_takes_them_away(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $target = $this->makeUser('Field Researcher', $tenant);
        Sanctum::actingAs($admin);

        $this->patchJson("/api/v1/admin/users/{$target->id}/roles", ['roles' => ['Field Researcher', 'Finance Officer']])
            ->assertStatus(202);
        $this->assertEqualsCanonicalizing(
            ['Field Researcher', 'Finance Officer', 'Finance Controller'],
            AccessRoleSyncRequest::query()->latest('id')->first()->roles
        );

        $target->syncRoles(['Field Researcher', 'Finance Officer', 'Finance Controller']);
        $this->patchJson("/api/v1/admin/users/{$target->id}/roles", ['roles' => ['Field Researcher', 'Finance Controller']])
            ->assertStatus(202);
        $this->assertSame(['Field Researcher'], AccessRoleSyncRequest::query()->latest('id')->first()->roles);
    }
}
