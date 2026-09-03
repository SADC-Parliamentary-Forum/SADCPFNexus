<?php

namespace Tests\Feature\Timesheets;

use App\Models\Tenant;
use App\Models\TimesheetProject;
use Tests\TestCase;

class TimesheetProjectSelfServiceTest extends TestCase
{
    public function test_unauthenticated_cannot_list_timesheet_projects(): void
    {
        $this->getJson('/api/v1/hr/timesheets/projects')->assertUnauthorized();
        $this->getJson('/api/v1/admin/timesheet-projects')->assertUnauthorized();
    }

    public function test_staff_can_list_own_tenant_projects_via_hr_endpoint(): void
    {
        $tenant = Tenant::factory()->create();
        $otherTenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $own = TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'Programme delivery',
            'sort_order' => 2,
        ]);
        TimesheetProject::create([
            'tenant_id' => $otherTenant->id,
            'label' => 'Other tenant secret',
            'sort_order' => 1,
        ]);
        TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'Admin support',
            'sort_order' => 1,
        ]);

        $payload = $http->getJson('/api/v1/hr/timesheets/projects')
            ->assertOk()
            ->assertJsonPath('data.0.label', 'Admin support')
            ->assertJsonPath('data.1.label', 'Programme delivery')
            ->json('data');

        $ids = collect($payload)->pluck('id')->all();
        $this->assertContains($own->id, $ids);
        $this->assertNotContains('Other tenant secret', collect($payload)->pluck('label')->all());
        $this->assertArrayHasKey('id', $payload[0]);
        $this->assertArrayHasKey('label', $payload[0]);
        $this->assertArrayHasKey('sort_order', $payload[0]);
    }

    public function test_title_case_staff_can_list_projects_via_hr_endpoint(): void
    {
        $tenant = Tenant::factory()->create();
        TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'EU Governance',
            'sort_order' => 1,
        ]);

        $user = $this->makeUser('Staff', $tenant);
        $this->asUser($user)
            ->getJson('/api/v1/hr/timesheets/projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'EU Governance']);
    }

    public function test_staff_can_list_admin_timesheet_projects_but_cannot_mutate(): void
    {
        $tenant = Tenant::factory()->create();
        $otherTenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $project = TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'Programme delivery',
            'sort_order' => 1,
        ]);
        TimesheetProject::create([
            'tenant_id' => $otherTenant->id,
            'label' => 'Other tenant secret',
            'sort_order' => 1,
        ]);

        $labels = collect($http->getJson('/api/v1/admin/timesheet-projects')
            ->assertOk()
            ->json('data'))
            ->pluck('label')
            ->all();
        $this->assertContains('Programme delivery', $labels);
        $this->assertNotContains('Other tenant secret', $labels);

        $http->postJson('/api/v1/admin/timesheet-projects', [
            'label' => 'Should not create',
        ])->assertForbidden();
        $http->putJson("/api/v1/admin/timesheet-projects/{$project->id}", [
            'label' => 'Should not update',
        ])->assertForbidden();
        $http->deleteJson("/api/v1/admin/timesheet-projects/{$project->id}")->assertForbidden();
        $http->postJson('/api/v1/hr/timesheets/projects', [
            'label' => 'Should not create via hr',
        ])->assertMethodNotAllowed();
        $http->putJson('/api/v1/hr/timesheets/projects', [
            'label' => 'Should not update via hr',
        ])->assertMethodNotAllowed();
        $http->patchJson('/api/v1/hr/timesheets/projects', [
            'label' => 'Should not patch via hr',
        ])->assertMethodNotAllowed();
        $http->deleteJson('/api/v1/hr/timesheets/projects')->assertMethodNotAllowed();
    }

    public function test_general_employee_can_list_projects_via_hr_endpoint(): void
    {
        $tenant = Tenant::factory()->create();
        TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'Programme delivery',
            'sort_order' => 1,
        ]);

        $user = $this->makeUser('General Employee', $tenant);
        $this->asUser($user)
            ->getJson('/api/v1/hr/timesheets/projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'Programme delivery']);
        $this->asUser($user)
            ->getJson('/api/v1/admin/timesheet-projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'Programme delivery']);
    }

    public function test_hr_admin_can_list_projects_for_templates_but_cannot_mutate_admin_catalog(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asHrAdmin($tenant);
        TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'EU Governance',
            'sort_order' => 1,
        ]);

        $http->getJson('/api/v1/hr/timesheets/projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'EU Governance']);
        $http->getJson('/api/v1/admin/timesheet-projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'EU Governance']);
        $http->postJson('/api/v1/admin/timesheet-projects', [
            'label' => 'HR should not create',
        ])->assertForbidden();
    }

    public function test_system_admin_still_cruds_timesheet_projects(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $created = $http->postJson('/api/v1/admin/timesheet-projects', [
            'label' => 'New programme',
            'sort_order' => 3,
        ])->assertCreated()->json('data');

        $this->assertSame('New programme', $created['label']);

        $http->getJson('/api/v1/admin/timesheet-projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'New programme']);
        $http->getJson('/api/v1/hr/timesheets/projects')
            ->assertOk()
            ->assertJsonFragment(['label' => 'New programme']);

        $http->putJson('/api/v1/admin/timesheet-projects/'.$created['id'], [
            'label' => 'Renamed programme',
        ])->assertOk()->assertJsonPath('data.label', 'Renamed programme');

        $http->deleteJson('/api/v1/admin/timesheet-projects/'.$created['id'])->assertOk();
        $this->assertDatabaseMissing('timesheet_projects', ['id' => $created['id']]);
    }
}
