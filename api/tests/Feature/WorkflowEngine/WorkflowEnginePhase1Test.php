<?php

namespace Tests\Feature\WorkflowEngine;

use App\Models\ApprovalWorkflow;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\WorkflowEngine\WorkflowIdempotencyKey;
use App\Modules\WorkflowEngine\Services\ConditionEvaluationService;
use App\Modules\WorkflowEngine\Services\DefinitionVersionService;
use App\Modules\WorkflowEngine\Services\WorkflowOrchestrator;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WorkflowEnginePhase1Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_definition_versioning_publish_and_historical_pin(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'supervisor', 'stage_type' => 'recommend', 'step_order' => 0],
            ['approver_type' => 'specific_role', 'stage_type' => 'approve', 'step_order' => 1, 'role' => 'Secretary General'],
        ]);

        $wf = ApprovalWorkflow::where('tenant_id', $tenant->id)->where('module_type', 'leave')->firstOrFail();
        $svc = app(DefinitionVersionService::class);
        $v1 = $svc->ensurePublishedSnapshot($wf, $admin);
        $this->assertSame('published', $v1->status);

        $v2 = $svc->createVersion($wf, $admin);
        $v2 = $svc->approve($v2, $admin);
        $v2 = $svc->publish($v2, $admin);

        $this->assertSame('published', $v2->fresh()->status);
        $this->assertSame('retired', $v1->fresh()->status);
        $this->assertSame(2, (int) $wf->fresh()->current_version);
    }

    public function test_sequential_path_and_conditional_branch_skip(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'recommend', 'step_order' => 0, 'step_name' => 'Recommend'],
            [
                'approver_type' => 'specific_user',
                'user_id' => $manager->id,
                'stage_type' => 'certify',
                'step_order' => 1,
                'step_name' => 'Finance Certify (high value)',
                'condition_expression' => ['field' => 'amount', 'op' => 'gte', 'value' => 999999],
                'skip_if_condition_false' => true,
            ],
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 2, 'step_name' => 'Final'],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff, 'leave-start-1', [
            'amount' => 100,
        ]);

        $this->assertNotNull($approval);
        $this->assertNotNull($approval->definition_version_id);
        $this->assertNotNull($approval->approval_package_hash);
        $this->assertSame(0, (int) $approval->current_step_index);

        $result = app(WorkflowService::class)->approve($approval->fresh(), $manager, 'ok', 'decide-1');
        $approval->refresh();
        $this->assertTrue(
            $approval->history()->where('action', 'skip')->exists()
            || ($result['advanced_to_step'] ?? null) === 2
            || (int) $approval->current_step_index === 2
            || $approval->status === 'approved'
        );
    }

    public function test_self_approval_blocked(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $staff->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $this->assertNotNull($approval);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(WorkflowService::class)->approve($approval->fresh(), $staff, 'self');
    }

    public function test_decide_idempotency(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $r1 = app(WorkflowService::class)->approve($approval->fresh(), $manager, 'first', 'idem-decide-abc');
        $r2 = app(WorkflowService::class)->approve($approval->fresh(), $manager, 'second', 'idem-decide-abc');

        $this->assertSame($r1['decision_id'] ?? null, $r2['decision_id'] ?? null);
        $this->assertSame(1, WorkflowIdempotencyKey::where('idempotency_key', 'idem-decide-abc')->count());
    }

    public function test_return_resubmit_recaptures_package(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 0, 'allow_return' => true],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $hash1 = $approval->approval_package_hash;

        app(WorkflowService::class)->returnForCorrection($approval->fresh(), $manager, 'Please fix dates');
        $approval->refresh();
        $this->assertSame('returned', $approval->status);

        $leave->update(['reason' => ($leave->reason ?? 'x').' revised']);
        app(WorkflowService::class)->resubmit($approval->fresh(), $staff);
        $approval->refresh();

        $this->assertSame('pending', $approval->status);
        $this->assertNotNull($approval->approval_package_hash);
        $this->assertNotSame($hash1, $approval->approval_package_hash);
        $this->assertGreaterThanOrEqual(2, $approval->packages()->count());
    }

    public function test_condition_engine_predicates(): void
    {
        $engine = app(ConditionEvaluationService::class);
        $this->assertTrue($engine->evaluate(['field' => 'amount', 'op' => 'gte', 'value' => 100], ['amount' => 150]));
        $this->assertFalse($engine->evaluate(['field' => 'amount', 'op' => 'gte', 'value' => 100], ['amount' => 50]));
        $this->assertTrue($engine->evaluate([
            'all' => [
                ['field' => 'currency', 'op' => 'eq', 'value' => 'NAD'],
                ['field' => 'amount', 'op' => 'gt', 'value' => 0],
            ],
        ], ['currency' => 'NAD', 'amount' => 10]));
    }

    public function test_inbox_awaiting_tasks(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 0, 'sla_hours' => 1],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        app(WorkflowService::class)->initiate($leave, 'leave', $staff);

        $tasks = app(WorkflowOrchestrator::class)->inbox($manager, ['status' => 'awaiting']);
        $this->assertNotEmpty($tasks);
        $this->assertSame($manager->id, $tasks[0]->assigned_user_id);
    }

    public function test_authority_denied_when_self_on_orchestrator(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $staff->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $step = $approval->workflow->steps->first();
        $result = app(WorkflowOrchestrator::class)->revalidateAuthority($approval, $staff, $step);
        $this->assertTrue($result['self_approval_conflict'] || ! $result['authorised']);
    }

    public function test_actor_resolution_specific_user(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);
        $wf = $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);
        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $actors = app(WorkflowService::class)->getCurrentApprovers($approval->fresh());
        $this->assertTrue(collect($actors)->contains(fn ($u) => (int) $u->id === (int) $manager->id));
        $this->assertSame($wf->id, $approval->workflow_id);
    }

    private function makeLeave(Tenant $tenant, $staff): LeaveRequest
    {
        return LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'reference_number' => 'LV-WF-'.uniqid(),
            'leave_type' => 'annual',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'days_requested' => 2,
            'reason' => 'Workflow engine test',
            'status' => 'draft',
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $steps
     */
    private function seedWorkflow(Tenant $tenant, string $module, array $steps): ApprovalWorkflow
    {
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => "Test {$module}"],
            ['module_type' => $module, 'is_active' => true, 'definition_status' => 'published']
        );
        $wf->steps()->delete();
        foreach ($steps as $i => $step) {
            $payload = $step;
            if (($payload['approver_type'] ?? '') === 'specific_role' && isset($payload['role'])) {
                $role = \Spatie\Permission\Models\Role::firstOrCreate([
                    'name' => $payload['role'],
                    'guard_name' => 'sanctum',
                ]);
                $payload['role_id'] = $role->id;
                unset($payload['role']);
            }
            $payload['step_order'] = $payload['step_order'] ?? $i;
            $payload['actor_selector'] = $payload['actor_selector'] ?? $payload['approver_type'];
            $wf->steps()->create($payload);
        }

        return $wf->fresh('steps');
    }
}
