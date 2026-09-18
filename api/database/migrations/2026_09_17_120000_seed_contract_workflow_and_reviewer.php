<?php

use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

/**
 * Seed the Contract Approval workflow (module_type = contract) for existing
 * tenants and grant the Governance Officer the legal/compliance reviewer
 * permissions. Mirrors WorkflowSeeder / RolesAndPermissionsSeeder for tenants
 * created before this module shipped. Idempotent.
 */
return new class extends Migration
{
    public function up(): void
    {
        $sgRole = Role::where('name', 'Secretary General')->where('guard_name', 'sanctum')->first();
        $finRole = Role::where('name', 'Finance Controller')->where('guard_name', 'sanctum')->first();
        $govRole = Role::where('name', 'Governance Officer')->where('guard_name', 'sanctum')->first();
        $directorRole = Role::where('name', 'Director')->where('guard_name', 'sanctum')->first();

        // Governance Officer acts as the legal/compliance reviewer for contracts.
        if ($govRole) {
            foreach (['sanctum', 'web'] as $guard) {
                $role = Role::where('name', 'Governance Officer')->where('guard_name', $guard)->first();
                if (! $role) {
                    continue;
                }
                $perms = Permission::whereIn('name', ['contract.view', 'contract.view_all', 'contract.review'])
                    ->where('guard_name', $guard)->get();
                $role->givePermissionTo($perms);
            }
        }

        Tenant::query()->each(function (Tenant $tenant) use ($sgRole, $finRole, $govRole, $directorRole): void {
            $steps = array_values(array_filter([
                $finRole ? ['step_order' => 0, 'approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $finRole->id, 'stage_type' => 'certify', 'step_name' => 'Finance Review', 'authority_action' => 'finance.certify', 'allow_return' => true, 'sla_hours' => 72] : null,
                $govRole ? ['step_order' => 1, 'approver_type' => 'specific_role', 'actor_selector' => 'specific_role', 'role_id' => $govRole->id, 'stage_type' => 'review', 'step_name' => 'Legal / Compliance Review', 'allow_return' => true, 'sla_hours' => 72, 'condition_expression' => ['field' => 'requires_legal_review', 'op' => 'eq', 'value' => true], 'skip_if_condition_false' => true] : null,
                $directorRole ? ['step_order' => 2, 'approver_type' => 'specific_role', 'actor_selector' => 'director_finance', 'role_id' => $directorRole->id, 'stage_type' => 'authorise', 'step_name' => 'Management Authorisation', 'authority_action' => 'finance.authorise', 'sla_hours' => 72, 'condition_expression' => ['field' => 'amount', 'op' => 'gte', 'value' => 10000], 'skip_if_condition_false' => true] : null,
                $sgRole ? ['step_order' => 3, 'approver_type' => 'specific_role', 'actor_selector' => 'sg', 'role_id' => $sgRole->id, 'stage_type' => 'approve', 'step_name' => 'Secretary General Approval', 'authority_action' => 'sg.approve', 'sla_hours' => 72] : null,
            ]));

            if ($steps === []) {
                return;
            }

            $wf = ApprovalWorkflow::updateOrCreate(
                ['tenant_id' => $tenant->id, 'name' => 'Contract Approval'],
                [
                    'module_type' => 'contract',
                    'record_type' => 'contract',
                    'is_active' => true,
                    'definition_status' => 'published',
                    'self_approval_policy' => ApprovalWorkflow::SELF_APPROVAL_DENIED,
                ],
            );

            $wf->steps()->delete();
            foreach ($steps as $order => $step) {
                $wf->steps()->create(array_merge(['step_order' => $order], $step));
            }
        });
    }

    public function down(): void
    {
        ApprovalWorkflow::where('name', 'Contract Approval')->where('module_type', 'contract')->each(function ($wf): void {
            $wf->steps()->delete();
            $wf->delete();
        });
    }
};
