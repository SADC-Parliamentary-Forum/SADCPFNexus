<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

class WorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (!$tenant) {
            return;
        }

        $sgRole = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();

        // Leave Approval Workflow: Supervisor → Up the chain → Secretary General (final)
        $leaveWf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'module_type' => 'leave'],
            ['name' => 'Standard Leave Approval', 'is_active' => true]
        );
        $leaveWf->steps()->delete();

        $leaveWf->steps()->create(['step_order' => 0, 'approver_type' => 'supervisor']);
        $leaveWf->steps()->create(['step_order' => 1, 'approver_type' => 'up_the_chain']);
        if ($sgRole) {
            $leaveWf->steps()->create([
                'step_order' => 2,
                'approver_type' => 'specific_role',
                'role_id' => $sgRole->id,
            ]);
        }

        // Travel Approval Workflow: Supervisor → Secretary General (final)
        $travelWf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'module_type' => 'travel'],
            ['name' => 'Standard Travel Approval', 'is_active' => true]
        );
        $travelWf->steps()->delete();

        $travelWf->steps()->create(['step_order' => 0, 'approver_type' => 'supervisor']);
        if ($sgRole) {
            $travelWf->steps()->create([
                'step_order' => 1,
                'approver_type' => 'specific_role',
                'role_id' => $sgRole->id,
            ]);
        }
    }
}
