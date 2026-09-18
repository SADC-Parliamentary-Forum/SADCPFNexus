<?php

namespace Tests\Feature\Admin;

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use Tests\TestCase;

/**
 * The workflow admin module catalogue must expose ALL workflow-able modules
 * (not a hardcoded few) plus any module already configured on the tenant.
 */
class WorkflowModuleCatalogueTest extends TestCase
{
    public function test_catalogue_lists_all_workflow_modules(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $res = $http->getJson('/api/v1/admin/workflows/module-catalogue')->assertOk();
        $values = collect($res->json('data'))->pluck('value');

        // Far more than the previous hardcoded nine, and covers newer modules.
        $this->assertGreaterThanOrEqual(20, $values->count());
        foreach (['leave', 'travel', 'procurement', 'contract', 'salary_advance', 'assets', 'risk', 'mande'] as $module) {
            $this->assertTrue($values->contains($module), "Catalogue missing module: {$module}");
        }
    }

    public function test_catalogue_includes_existing_custom_module_types(): void
    {
        $tenant = Tenant::factory()->create();
        ApprovalWorkflow::create([
            'tenant_id' => $tenant->id, 'name' => 'Custom Flow', 'module_type' => 'custom_widget_approval',
            'record_type' => 'custom_widget_approval', 'is_active' => true,
        ]);

        [$http] = $this->asAdmin($tenant);
        $res = $http->getJson('/api/v1/admin/workflows/module-catalogue')->assertOk();
        $values = collect($res->json('data'))->pluck('value');

        // A configured-but-non-canonical module remains editable.
        $this->assertTrue($values->contains('custom_widget_approval'));
    }
}
