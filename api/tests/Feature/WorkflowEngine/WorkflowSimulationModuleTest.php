<?php

namespace Tests\Feature\WorkflowEngine;

use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\Tenant;
use App\Models\WorkflowEngine\WorkflowSimulation;
use App\Modules\WorkflowEngine\Services\WorkflowSimulationService;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WorkflowSimulationModuleTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_catalog_lists_module_fields_and_presets_for_tenant_workflows(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $this->seedProcurementWorkflow($tenant, $admin->id);
        $this->seedLeaveWorkflow($tenant, $admin->id);

        $response = $this->asUser($admin)->getJson('/api/v1/workflow-engine/simulation-catalog');

        $response->assertOk();
        $modules = collect($response->json('data.modules'));
        $this->assertNotEmpty($modules);

        $procurement = $modules->firstWhere('module_type', 'procurement');
        $this->assertNotNull($procurement);
        $this->assertNotEmpty($procurement['fields']);
        $this->assertTrue(collect($procurement['fields'])->contains(fn ($f) => ($f['key'] ?? '') === 'amount'));
        $this->assertTrue(collect($procurement['fields'])->contains(fn ($f) => ($f['key'] ?? '') === 'procurement_method'));
        $this->assertNotEmpty($procurement['presets']);
        $this->assertNotEmpty($procurement['workflows']);

        $leave = $modules->firstWhere('module_type', 'leave');
        $this->assertNotNull($leave);
        $this->assertTrue(collect($leave['fields'])->contains(fn ($f) => ($f['key'] ?? '') === 'leave_type'));
        $this->assertTrue(collect($leave['fields'])->contains(fn ($f) => ($f['key'] ?? '') === 'leave_days'));
        $this->assertFalse(collect($leave['fields'])->contains(fn ($f) => ($f['key'] ?? '') === 'procurement_method'));
    }

    public function test_catalog_requires_simulate_permission(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $this->asUser($staff)
            ->getJson('/api/v1/workflow-engine/simulation-catalog')
            ->assertForbidden();
    }

    public function test_procurement_high_value_includes_finance_stage_low_value_skips_it(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $wf = $this->seedProcurementWorkflow($tenant, $admin->id);

        $low = $this->asUser($admin)->postJson("/api/v1/workflow-engine/definitions/{$wf->id}/simulate", [
            'test_context' => [
                'amount' => 1200,
                'currency' => 'NAD',
                'procurement_method' => 'rfq',
            ],
            'scenario_key' => 'below_finance',
        ]);
        $low->assertCreated();
        $lowPath = collect($low->json('data.result.applicable_path'))->pluck('step_name')->filter()->values();
        $this->assertFalse($lowPath->contains('Finance Certification'));
        $this->assertTrue($lowPath->contains('Supervisor Recommendation'));
        $this->assertSame('procurement', $low->json('data.result.module_type'));
        $this->assertFalse($low->json('data.result.created_production_approval'));
        $this->assertFalse($low->json('created_production_approval'));

        $high = $this->asUser($admin)->postJson("/api/v1/workflow-engine/definitions/{$wf->id}/simulate", [
            'test_context' => [
                'amount' => 50000,
                'currency' => 'NAD',
                'procurement_method' => 'tender',
            ],
            'scenario_key' => 'above_finance',
        ]);
        $high->assertCreated();
        $highPath = collect($high->json('data.result.applicable_path'))->pluck('step_name')->filter()->values();
        $this->assertTrue($highPath->contains('Finance Certification'));
        $this->assertTrue($highPath->contains('SG Approval'));
        $this->assertNotEquals($lowPath->all(), $highPath->all());
    }

    public function test_timesheet_donor_funded_path_differs_from_core_hours(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $wf = $this->seedTimesheetWorkflow($tenant, $admin->id);

        $core = app(WorkflowSimulationService::class)->simulate($wf, $admin, [
            'is_donor_funded' => false,
            'hours' => 40,
        ]);
        $donor = app(WorkflowSimulationService::class)->simulate($wf, $admin, [
            'is_donor_funded' => true,
            'hours' => 40,
            'project_code' => 'SADC-PF-01',
        ]);

        $coreNames = collect($core->result['applicable_path'])->pluck('step_name')->all();
        $donorNames = collect($donor->result['applicable_path'])->pluck('step_name')->all();

        $this->assertContains('Supervisor Acceptance', $coreNames);
        $this->assertNotContains('Finance/Project Validation', $coreNames);
        $this->assertContains('Finance/Project Validation', $donorNames);
        $this->assertSame('timesheet', $donor->result['module_type']);
    }

    public function test_leave_simulation_uses_leave_context_not_a_generic_amount(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);
        $wf = $this->seedLeaveWorkflow($tenant, $admin->id);

        $before = ApprovalRequest::count();
        $response = $this->asUser($admin)->postJson("/api/v1/workflow-engine/definitions/{$wf->id}/simulate", [
            'requester_user_id' => $staff->id,
            'test_context' => [
                'leave_type' => 'annual',
                'leave_days' => 12,
                'is_emergency' => false,
            ],
            'scenario_key' => 'annual_standard',
        ]);

        $response->assertCreated();
        $this->assertSame($before, ApprovalRequest::count());
        $this->assertSame(1, WorkflowSimulation::count());
        $this->assertSame('leave', $response->json('data.result.module_type'));
        $this->assertSame('annual', $response->json('data.result.normalized_context.leave_type'));
        $this->assertSame(12, (int) $response->json('data.result.normalized_context.leave_days'));
        $this->assertArrayNotHasKey('procurement_method', $response->json('data.result.normalized_context') ?? []);
        $this->assertSame($staff->id, (int) $response->json('data.result.requester.id'));
        $path = collect($response->json('data.result.applicable_path'))->pluck('step_name');
        $this->assertTrue($path->contains('HOD Recommendation'));
        $this->assertTrue($path->contains('Head of Institution Authorisation'));
    }

    public function test_simulate_rejects_requester_from_another_tenant(): void
    {
        $tenant = Tenant::factory()->create();
        $other = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $outsider = $this->makeUser('staff', $other);
        $wf = $this->seedLeaveWorkflow($tenant, $admin->id);

        $this->asUser($admin)
            ->postJson("/api/v1/workflow-engine/definitions/{$wf->id}/simulate", [
                'requester_user_id' => $outsider->id,
                'test_context' => ['leave_type' => 'annual', 'leave_days' => 2],
            ])
            ->assertNotFound();
    }

    /**
     * @param  array<int, array<string, mixed>>  $steps
     */
    private function seedWorkflow(Tenant $tenant, string $module, string $name, array $steps): ApprovalWorkflow
    {
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => $name],
            ['module_type' => $module, 'is_active' => true, 'definition_status' => 'published']
        );
        $wf->steps()->delete();
        foreach ($steps as $i => $step) {
            $payload = $step;
            $payload['step_order'] = $payload['step_order'] ?? $i;
            $payload['actor_selector'] = $payload['actor_selector'] ?? $payload['approver_type'];
            $wf->steps()->create($payload);
        }

        return $wf->fresh('steps');
    }

    private function seedProcurementWorkflow(Tenant $tenant, int $userId): ApprovalWorkflow
    {
        return $this->seedWorkflow($tenant, 'procurement', 'Procurement Approval', [
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'recommend', 'step_name' => 'Supervisor Recommendation'],
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'authorise', 'step_name' => 'HOD Authorisation'],
            [
                'approver_type' => 'specific_user',
                'user_id' => $userId,
                'stage_type' => 'certify',
                'step_name' => 'Finance Certification',
                'condition_expression' => ['field' => 'amount', 'op' => 'gte', 'value' => 5000],
                'skip_if_condition_false' => true,
            ],
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'approve', 'step_name' => 'SG Approval'],
        ]);
    }

    private function seedLeaveWorkflow(Tenant $tenant, int $userId): ApprovalWorkflow
    {
        return $this->seedWorkflow($tenant, 'leave', 'Standard Leave Approval', [
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'recommend', 'step_name' => 'HOD Recommendation'],
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'review', 'step_name' => 'Department Review'],
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'certify', 'step_name' => 'Administration Certification'],
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'authorise', 'step_name' => 'Head of Institution Authorisation'],
        ]);
    }

    private function seedTimesheetWorkflow(Tenant $tenant, int $userId): ApprovalWorkflow
    {
        return $this->seedWorkflow($tenant, 'timesheet', 'Timesheet Approval', [
            ['approver_type' => 'specific_user', 'user_id' => $userId, 'stage_type' => 'accept', 'step_name' => 'Supervisor Acceptance'],
            [
                'approver_type' => 'specific_user',
                'user_id' => $userId,
                'stage_type' => 'certify',
                'step_name' => 'Finance/Project Validation',
                'condition_expression' => ['field' => 'is_donor_funded', 'op' => 'eq', 'value' => true],
                'skip_if_condition_false' => true,
            ],
        ]);
    }
}
