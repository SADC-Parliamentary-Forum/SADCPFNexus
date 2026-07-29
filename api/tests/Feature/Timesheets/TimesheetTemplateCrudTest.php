<?php

namespace Tests\Feature\Timesheets;

use App\Models\Tenant;
use App\Models\TimesheetProject;
use App\Models\TimesheetTemplate;
use App\Models\User;
use Tests\TestCase;

class TimesheetTemplateCrudTest extends TestCase
{
    private function seedHrContext(): array
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->assignRole('staff');
        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');

        $project = TimesheetProject::create([
            'tenant_id' => $tenant->id,
            'label' => 'EU Governance',
            'sort_order' => 1,
        ]);

        return compact('tenant', 'employee', 'hr', 'project');
    }

    public function test_hr_admin_can_create_update_and_deactivate_template(): void
    {
        $ctx = $this->seedHrContext();

        $created = $this->actingAs($ctx['hr'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets/templates', [
                'name' => 'EU weekly',
                'code' => 'EU-WK',
                'donor_name' => 'EU',
                'description' => 'EU programme template',
                'sort_order' => 2,
                'defaults' => [
                    'project_id' => $ctx['project']->id,
                    'work_bucket' => 'delivery',
                    'entry_category' => 'donor',
                    'hours' => 8,
                ],
            ])
            ->assertCreated()
            ->assertJsonPath('data.code', 'EU-WK')
            ->assertJsonPath('data.is_active', true);

        $id = $created->json('data.id');
        $this->assertNotNull($id);

        $this->actingAs($ctx['hr'], 'sanctum')
            ->putJson("/api/v1/hr/timesheets/templates/{$id}", [
                'name' => 'EU weekly revised',
                'donor_name' => 'European Union',
                'defaults' => [
                    'project_id' => $ctx['project']->id,
                    'work_bucket' => 'administration',
                    'hours' => 7.5,
                ],
            ])
            ->assertOk()
            ->assertJsonPath('data.name', 'EU weekly revised')
            ->assertJsonPath('data.donor_name', 'European Union')
            ->assertJsonPath('data.defaults.work_bucket', 'administration')
            ->assertJsonPath('data.defaults.hours', 7.5);

        $this->actingAs($ctx['hr'], 'sanctum')
            ->postJson("/api/v1/hr/timesheets/templates/{$id}/deactivate")
            ->assertOk()
            ->assertJsonPath('data.is_active', false);

        $this->assertDatabaseHas('timesheet_templates', [
            'id' => $id,
            'is_active' => false,
            'name' => 'EU weekly revised',
        ]);
    }

    public function test_admin_list_can_include_inactive_templates(): void
    {
        $ctx = $this->seedHrContext();

        TimesheetTemplate::create([
            'tenant_id' => $ctx['tenant']->id,
            'name' => 'Active one',
            'code' => 'ACT-01',
            'is_active' => true,
            'defaults' => ['hours' => 8],
        ]);
        TimesheetTemplate::create([
            'tenant_id' => $ctx['tenant']->id,
            'name' => 'Inactive one',
            'code' => 'INA-01',
            'is_active' => false,
            'defaults' => ['hours' => 4],
        ]);

        $this->actingAs($ctx['employee'], 'sanctum')
            ->getJson('/api/v1/hr/timesheets/templates')
            ->assertOk()
            ->assertJsonFragment(['code' => 'ACT-01'])
            ->assertJsonMissing(['code' => 'INA-01']);

        $this->actingAs($ctx['hr'], 'sanctum')
            ->getJson('/api/v1/hr/timesheets/templates?include_inactive=1')
            ->assertOk()
            ->assertJsonFragment(['code' => 'ACT-01'])
            ->assertJsonFragment(['code' => 'INA-01']);
    }

    public function test_staff_cannot_create_or_update_templates(): void
    {
        $ctx = $this->seedHrContext();

        $this->actingAs($ctx['employee'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets/templates', [
                'name' => 'Unauthorized',
                'code' => 'NOPE',
            ])
            ->assertForbidden();

        $template = TimesheetTemplate::create([
            'tenant_id' => $ctx['tenant']->id,
            'name' => 'Protected',
            'code' => 'PROT',
            'is_active' => true,
            'defaults' => [],
        ]);

        $this->actingAs($ctx['employee'], 'sanctum')
            ->putJson("/api/v1/hr/timesheets/templates/{$template->id}", [
                'name' => 'Hacked',
            ])
            ->assertForbidden();

        $this->actingAs($ctx['employee'], 'sanctum')
            ->postJson("/api/v1/hr/timesheets/templates/{$template->id}/deactivate")
            ->assertForbidden();
    }
}
