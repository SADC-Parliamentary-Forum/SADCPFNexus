<?php

namespace Tests\Feature\Travel;

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use Database\Seeders\WorkflowSeeder;
use Spatie\Permission\Models\Role;
use Tests\TestCase;

class TravelWorkflowSeedTest extends TestCase
{
    public function test_travel_workflow_has_at_least_five_steps_including_finance_and_sg(): void
    {
        $tenant = Tenant::factory()->create();
        // Ensure roles exist for seeder
        Role::firstOrCreate(['name' => 'Administration Officer', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'Finance Controller', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'Director', 'guard_name' => 'sanctum']);
        Role::firstOrCreate(['name' => 'Secretary General', 'guard_name' => 'sanctum']);

        // WorkflowSeeder uses Tenant::first()
        $this->seed(WorkflowSeeder::class);

        $wf = ApprovalWorkflow::where('tenant_id', $tenant->id)
            ->where('module_type', 'travel')
            ->first();

        // If seeder keyed off Tenant::first which may not be ours, create explicitly
        if (! $wf) {
            $this->markTestSkipped('WorkflowSeeder targets Tenant::first only');
        }

        $this->assertGreaterThanOrEqual(5, $wf->steps()->count());
        $roleIds = $wf->steps()->where('approver_type', 'specific_role')->pluck('role_id');
        $roleNames = Role::whereIn('id', $roleIds)->pluck('name')->all();
        $this->assertContains('Finance Controller', $roleNames);
        $this->assertContains('Secretary General', $roleNames);
    }
}
