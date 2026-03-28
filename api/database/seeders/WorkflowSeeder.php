<?php

namespace Database\Seeders;

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;

/**
 * Seeds approval workflows for all system modules:
 * leave, travel, imprest, correspondence, procurement, finance, hr, governance, programmes.
 *
 * Workflow convention:
 *  - Standard: Supervisor → Secretary General
 *  - Financial/compliance: Supervisor → Head of Chain → Secretary General
 *  - HR Admin: Supervisor → HR Administrator → Secretary General
 *  - Governance: Head of Chain → Secretary General
 */
class WorkflowSeeder extends Seeder
{
    public function run(): void
    {
        $tenant = Tenant::first();
        if (! $tenant) {
            return;
        }

        $sgRole      = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();
        $hrRole      = Role::where('name', 'HR Manager')->where('guard_name', 'sanctum')->first();
        $hrAdminRole = Role::where('name', 'HR Administrator')->where('guard_name', 'sanctum')->first();
        $finRole     = Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $govRole     = Role::where('name', 'Governance Officer')->where('guard_name', 'sanctum')->first();

        $this->makeWorkflow($tenant, 'Standard Leave Approval',           'leave',          [
            ['approver_type' => 'supervisor'],
            ['approver_type' => 'up_the_chain'],
            ...($hrRole ? [['approver_type' => 'specific_role', 'role_id' => $hrRole->id]] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Standard Travel & Mission Approval', 'travel', [
            ['approver_type' => 'supervisor'],
            ...($sgRole ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Imprest Advance Approval',          'imprest', [
            ['approver_type' => 'supervisor'],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id]] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Correspondence Approval',           'correspondence', [
            ['approver_type' => 'supervisor'],
            ['approver_type' => 'up_the_chain'],
            ...($sgRole ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Procurement Approval',              'procurement', [
            ['approver_type' => 'supervisor'],
            ['approver_type' => 'up_the_chain'],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id]] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Finance & Payment Approval',        'finance', [
            ['approver_type' => 'supervisor'],
            ...($finRole ? [['approver_type' => 'specific_role', 'role_id' => $finRole->id]] : []),
            ...($sgRole  ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'HR Request Approval',               'hr', [
            ['approver_type' => 'supervisor'],
            ...($hrAdminRole ?? $hrRole ? [['approver_type' => 'specific_role', 'role_id' => ($hrAdminRole ?? $hrRole)->id]] : []),
            ...($sgRole ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Governance Approval',               'governance', [
            ['approver_type' => 'up_the_chain'],
            ...($sgRole ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);

        $this->makeWorkflow($tenant, 'Programme Activity Approval',       'programmes', [
            ['approver_type' => 'supervisor'],
            ['approver_type' => 'up_the_chain'],
            ...($sgRole ? [['approver_type' => 'specific_role', 'role_id' => $sgRole->id]] : []),
        ]);
    }

    private function makeWorkflow(Tenant $tenant, string $name, string $module, array $steps): void
    {
        // With the new unique-constraint-free schema, we use name to find existing.
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => $name],
            ['module_type' => $module, 'is_active' => true]
        );

        $wf->steps()->delete();

        foreach ($steps as $order => $step) {
            $wf->steps()->create(array_merge(['step_order' => $order], $step));
        }

        $this->command->info("Workflow '{$name}' seeded with " . count($steps) . ' steps.');
    }
}
