<?php

namespace Tests\Unit\AccessControl;

use App\Modules\AccessControl\Services\CanonicalRoleManager;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class CanonicalRoleManagerTest extends TestCase
{
    public function test_title_case_staff_is_a_general_employee_alias(): void
    {
        $manager = app(CanonicalRoleManager::class);

        $this->assertSame('General Employee', $manager->canonicalize('Staff'));
        $this->assertContains('Staff', $manager->assignmentRoleNames('General Employee'));
        $this->assertContains('staff', $manager->assignmentRoleNames('Staff'));
    }

    public function test_title_case_staff_role_does_not_receive_organisation_hubs(): void
    {
        $role = Role::findByName('Staff', 'sanctum');
        $names = $role->permissions->pluck('name');

        foreach (['travel.view', 'finance.view', 'procurement.view', 'assets.view', 'hr.view', 'reports.view'] as $hub) {
            $this->assertFalse($names->contains($hub), $hub.' must not be on the Staff alias');
        }

        $this->assertTrue($names->contains('travel.create'));
        $this->assertTrue($names->contains('leave.view'));
        $this->assertTrue($names->contains('imprest.view'));
    }
}
