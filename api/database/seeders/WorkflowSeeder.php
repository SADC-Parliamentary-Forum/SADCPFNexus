<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

class WorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (!$tenant) return;

        // Leave Approval Workflow
        $leaveWf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'module_type' => 'leave'],
            ['name' => 'Standard Leave Approval', 'is_active' => true]
        );

        $leaveWf->steps()->delete();
        
        // Step 1: Direct Supervisor
        $leaveWf->steps()->create([
            'step_order' => 0,
            'approver_type' => 'supervisor',
        ]);

        // Step 2: Head of Chain (Parent Department Supervisor)
        $leaveWf->steps()->create([
            'step_order' => 1,
            'approver_type' => 'up_the_chain',
        ]);
        
        // Travel Approval Workflow
        $travelWf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'module_type' => 'travel'],
            ['name' => 'Standard Travel Approval', 'is_active' => true]
        );
        $travelWf->steps()->delete();
        $travelWf->steps()->create([
            'step_order' => 0,
            'approver_type' => 'supervisor',
        ]);
    }
}
