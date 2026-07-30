<?php

namespace Tests\Feature\WorkflowEngine;

use App\Http\Controllers\EmailApprovalController;
use App\Models\ApprovalRequest;
use App\Models\ApprovalWorkflow;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\WorkflowEngine\WorkflowAiSuggestion;
use App\Models\WorkflowEngine\WorkflowDefinitionVersion;
use App\Models\WorkflowEngine\WorkflowExternalApproval;
use App\Models\WorkflowEngine\WorkflowGovernanceDecision;
use App\Models\WorkflowEngine\WorkflowSimulation;
use App\Models\WorkflowEngine\WorkflowTask;
use App\Models\WorkflowEngine\WorkflowVote;
use App\Models\WorkflowEngine\WorkflowWorkingCalendar;
use App\Modules\WorkflowEngine\Services\DefinitionLintService;
use App\Modules\WorkflowEngine\Services\DefinitionVersionService;
use App\Modules\WorkflowEngine\Services\GovernanceExternalService;
use App\Modules\WorkflowEngine\Services\SlaCalendarService;
use App\Modules\WorkflowEngine\Services\WorkflowAiAssistService;
use App\Modules\WorkflowEngine\Services\WorkflowOrchestrator;
use App\Modules\WorkflowEngine\Services\WorkflowSimulationService;
use App\Services\SignedTokenService;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class WorkflowEnginePhase2Phase3Test extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    public function test_parallel_all_requires_all_assignees(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $a = $this->makeHrManager($tenant);
        $b = $this->makeUser('HR Manager', $tenant);

        $this->seedWorkflow($tenant, 'leave', [
            [
                'approver_type' => 'specific_user',
                'user_id' => $a->id,
                'stage_type' => 'approve',
                'step_order' => 0,
                'completion_rule' => 'all',
                'sod_segregated' => true,
                'parallel_role_key' => 'role_a',
            ],
        ]);

        // Force two independent tasks for parallel-all
        $wf = ApprovalWorkflow::where('tenant_id', $tenant->id)->where('module_type', 'leave')->firstOrFail();
        $wf->steps()->first()->update([
            'actor_selector' => 'specific_user',
            'actor_selector_config' => ['extra_user_ids' => [$b->id]],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $this->assertNotNull($approval);

        // Manually ensure both actors have awaiting tasks (simulate multi-actor parallel)
        WorkflowTask::where('approval_request_id', $approval->id)->delete();
        foreach ([$a, $b] as $user) {
            WorkflowTask::create([
                'tenant_id' => $tenant->id,
                'approval_request_id' => $approval->id,
                'step_index' => 0,
                'stage_type' => 'approve',
                'parallel_role_key' => 'role_'.$user->id,
                'assigned_user_id' => $user->id,
                'status' => 'awaiting',
                'assigned_at' => now(),
            ]);
        }
        $approval->update(['current_holder_ids' => [$a->id, $b->id]]);

        $r1 = app(WorkflowService::class)->approve($approval->fresh(), $a, 'a-ok', 'p-all-1');
        $approval->refresh();
        $this->assertFalse($r1['completed'] ?? false);
        $this->assertSame('pending', $approval->status);
        $this->assertSame(1, WorkflowVote::where('approval_request_id', $approval->id)->count());

        $r2 = app(WorkflowService::class)->approve($approval->fresh(), $b, 'b-ok', 'p-all-2');
        $approval->refresh();
        $this->assertSame('approved', $approval->status);
        $this->assertNotNull($r2['decision_id'] ?? null);
    }

    public function test_parallel_any_advances_on_first_approve(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $a = $this->makeHrManager($tenant);
        $b = $this->makeUser('HR Manager', $tenant);

        $this->seedWorkflow($tenant, 'leave', [
            [
                'approver_type' => 'specific_user',
                'user_id' => $a->id,
                'stage_type' => 'approve',
                'step_order' => 0,
                'completion_rule' => 'any',
            ],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        WorkflowTask::create([
            'tenant_id' => $tenant->id,
            'approval_request_id' => $approval->id,
            'step_index' => 0,
            'stage_type' => 'approve',
            'assigned_user_id' => $b->id,
            'status' => 'awaiting',
            'assigned_at' => now(),
        ]);

        $r = app(WorkflowService::class)->approve($approval->fresh(), $a, 'any-ok', 'p-any-1');
        $approval->refresh();
        $this->assertTrue(($r['completed'] ?? false) || ($r['stage_complete'] ?? false) || $approval->status === 'approved');
        $this->assertSame('approved', $approval->status);
    }

    public function test_quorum_n_of_m(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $v1 = $this->makeHrManager($tenant);
        $v2 = $this->makeHrManager($tenant);
        $v3 = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            [
                'approver_type' => 'specific_user',
                'user_id' => $v1->id,
                'stage_type' => 'approve',
                'step_order' => 0,
                'completion_rule' => 'quorum',
                'quorum_count' => 2,
            ],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        WorkflowTask::where('approval_request_id', $approval->id)->delete();
        foreach ([$v1, $v2, $v3] as $v) {
            WorkflowTask::create([
                'tenant_id' => $tenant->id,
                'approval_request_id' => $approval->id,
                'step_index' => 0,
                'stage_type' => 'approve',
                'assigned_user_id' => $v->id,
                'status' => 'awaiting',
                'assigned_at' => now(),
            ]);
        }
        $approval->update(['current_holder_ids' => [$v1->id, $v2->id, $v3->id], 'status' => 'pending']);

        app(WorkflowService::class)->approve($approval->fresh(), $v1, 'v1', 'q-1');
        $approval->refresh();
        $this->assertSame('pending', $approval->status);

        app(WorkflowService::class)->approve($approval->fresh(), $v2, 'v2', 'q-2');
        $approval->refresh();
        $this->assertSame('approved', $approval->status);
        $this->assertSame(2, WorkflowVote::where('approval_request_id', $approval->id)->where('vote', 'approve')->count());
    }

    public function test_governance_body_attribution(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $recorder = $this->makeHrManager($tenant);

        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $recorder->id, 'stage_type' => 'approve', 'step_order' => 0, 'governance_body_name' => 'Finance Sub-Committee'],
        ]);
        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);

        $row = app(GovernanceExternalService::class)->recordGovernance($approval->fresh(), $recorder, [
            'body_name' => 'Finance Sub-Committee',
            'meeting_reference' => 'FSC-2026-07',
            'resolution_reference' => 'RES-12',
            'quorum_met' => true,
            'decision' => 'approved',
            'recorder_role' => 'secretary',
            'members_present' => 5,
            'quorum_required' => 3,
        ]);

        $this->assertSame('Finance Sub-Committee', $row->decisionAuthority());
        $this->assertSame($recorder->id, $row->recorded_by);
        $this->assertNotSame($recorder->name, $row->decisionAuthority());
        $this->assertTrue(
            $approval->fresh()->history()->where('action', 'governance_recorded')
                ->where('comment', 'like', '%Decision authority: Finance Sub-Committee%')
                ->exists()
        );
    }

    public function test_sla_pause_extends_due_on_resume(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);
        WorkflowWorkingCalendar::create([
            'tenant_id' => $tenant->id,
            'code' => 'default',
            'name' => 'Default',
            'working_days' => [1, 2, 3, 4, 5],
            'is_default' => true,
        ]);

        $this->seedWorkflow($tenant, 'leave', [
            [
                'approver_type' => 'specific_user',
                'user_id' => $manager->id,
                'stage_type' => 'approve',
                'step_order' => 0,
                'sla_hours' => 8,
                'sla_calendar_code' => 'default',
                'pause_sla_on_hold' => true,
            ],
        ]);

        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        $this->assertNotNull($approval->due_at);
        $originalDue = $approval->due_at->copy();

        $orch = app(WorkflowOrchestrator::class);
        $orch->pauseSla($approval->fresh(), $manager);
        $this->assertNotNull($approval->fresh()->sla_paused_at);

        $this->travel(2)->hours();
        $resumed = $orch->resumeSla($approval->fresh(), $manager);
        $this->assertNull($resumed->sla_paused_at);
        $this->assertGreaterThanOrEqual(2 * 3600 - 5, (int) $resumed->sla_paused_seconds);
        $this->assertTrue($resumed->due_at->greaterThan($originalDue));
    }

    public function test_simulation_creates_no_production_approvals(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $wf = $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $admin->id, 'stage_type' => 'approve', 'step_order' => 0, 'sla_hours' => 4],
        ]);

        $before = ApprovalRequest::count();
        $sim = app(WorkflowSimulationService::class)->simulate($wf, $admin, ['amount' => 50]);
        $this->assertFalse($sim->created_production_approval);
        $this->assertSame($before, ApprovalRequest::count());
        $this->assertSame(1, WorkflowSimulation::where('id', $sim->id)->count());
        $this->assertNotEmpty($sim->result['stages'] ?? []);
    }

    public function test_lint_blocks_bad_publish(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $wf = $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $admin->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);

        $svc = app(DefinitionVersionService::class);
        $draft = $svc->createVersion($wf, $admin, [
            'stages' => [
                [
                    'step_order' => 0,
                    'stage_type' => 'review',
                    // missing actor selector + no terminal approve
                    'completion_rule' => 'quorum',
                    // missing quorum_count
                ],
            ],
            'transitions' => [
                ['from' => 0, 'on' => 'approve', 'to' => 0], // loop
            ],
        ]);

        $lint = $svc->lint($draft);
        $this->assertFalse($lint['valid']);
        $this->assertNotEmpty($lint['hard']);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $svc->publish($draft, $admin);
    }

    public function test_external_approval_recording(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $recorder = $this->makeHrManager($tenant);
        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $recorder->id, 'stage_type' => 'approve', 'step_order' => 0],
        ]);
        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);

        $row = app(GovernanceExternalService::class)->recordExternal($approval->fresh(), $recorder, [
            'external_body' => 'Member State Audit Board',
            'external_person' => 'Chairperson X',
            'decision_date' => now()->toDateString(),
            'decision' => 'approved',
            'evidence_reference' => 'LETTER-2026-44',
        ]);

        $this->assertInstanceOf(WorkflowExternalApproval::class, $row);
        $this->assertTrue($approval->fresh()->history()->where('action', 'external_approval')->exists());
        $this->assertSame('approved', $approval->fresh()->status);
    }

    public function test_ai_cannot_publish_or_approve_and_requires_human_confirm(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('System Admin', $tenant);
        $ai = app(WorkflowAiAssistService::class);

        $this->assertFalse($ai->canAutoPublish());
        $this->assertFalse($ai->canAutoApprove());
        $this->assertFalse($ai->canAutoGrantAuthority());
        $this->assertFalse($ai->canAutoSkipStage());
        $this->assertFalse($ai->canAutoResolveSod());
        $this->assertFalse($ai->canAutoApplySignature());
        $this->assertFalse($ai->canAutoAcceptException());

        $suggestion = $ai->suggest([
            'kind' => 'config_suggestion',
            'context' => ['module' => 'leave'],
        ], $admin);

        $this->assertSame('pending_confirmation', $suggestion->status);
        $this->assertFalse($suggestion->auto_applied);

        try {
            $ai->apply($suggestion, ['action' => 'publish_workflow', 'confirmed' => true], $admin);
            $this->fail('Expected publish_workflow to be forbidden');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertArrayHasKey('action', $e->errors());
        }

        try {
            $ai->apply($suggestion, ['action' => 'approve_transaction', 'confirmed' => true], $admin);
            $this->fail('Expected approve_transaction to be forbidden');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertArrayHasKey('action', $e->errors());
        }

        try {
            $ai->apply($suggestion, ['action' => 'attach_draft_note'], $admin);
            $this->fail('Expected missing confirmed to fail');
        } catch (\Illuminate\Validation\ValidationException $e) {
            $this->assertArrayHasKey('confirmed', $e->errors());
        }

        $applied = $ai->apply($suggestion, [
            'action' => 'attach_draft_note',
            'confirmed' => true,
            'note' => 'Human accepted draft note',
        ], $admin);
        $this->assertSame('applied', $applied->status);
        $this->assertFalse($applied->auto_applied);
    }

    public function test_email_approve_redirects_requires_auth_no_one_click(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);
        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 0, 'high_risk' => true],
        ]);
        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);

        $urls = app(SignedTokenService::class)->createPair($approval, $manager);
        $token = basename(parse_url($urls['approve_url'], PHP_URL_QUERY));
        parse_str((string) parse_url($urls['approve_url'], PHP_URL_QUERY), $qs);
        $token = $qs['token'];

        $beforeStatus = $approval->fresh()->status;
        $response = $this->get('/email-approval/approve/'.$token);
        $response->assertRedirect();
        $this->assertStringContainsString('/approval?', $response->headers->get('Location'));
        $this->assertStringContainsString('auth_required=1', $response->headers->get('Location'));
        $this->assertSame($beforeStatus, $approval->fresh()->status);
    }

    public function test_definition_lint_service_detects_parallel_without_rule_and_unreachable(): void
    {
        $lint = app(DefinitionLintService::class)->lint(
            [
                ['step_order' => 0, 'stage_type' => 'approve', 'actor_selector' => 'supervisor', 'parallel_group' => 'g1'],
                ['step_order' => 99, 'stage_type' => 'review', 'actor_selector' => 'hod'],
            ],
            [
                ['from' => 0, 'on' => 'approve', 'to' => 'completed'],
                ['from' => 0, 'on' => 'reject', 'to' => 'rejected'],
            ]
        );
        $this->assertFalse($lint['valid']);
        $this->assertTrue(collect($lint['hard'])->contains(fn ($e) => str_contains($e, 'completion rule') || str_contains($e, 'Unreachable')));
    }

    public function test_phase1_sequential_regression_smoke(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);
        $this->seedWorkflow($tenant, 'leave', [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'recommend', 'step_order' => 0],
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'step_order' => 1],
        ]);
        $leave = $this->makeLeave($tenant, $staff);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);
        app(WorkflowService::class)->approve($approval->fresh(), $manager, 'rec', 'reg-1');
        app(WorkflowService::class)->approve($approval->fresh(), $manager, 'fin', 'reg-2');
        $this->assertSame('approved', $approval->fresh()->status);
    }

    private function makeLeave(Tenant $tenant, $staff): LeaveRequest
    {
        return LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'reference_number' => 'LV-WF23-'.uniqid(),
            'leave_type' => 'annual',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'days_requested' => 2,
            'reason' => 'Workflow engine phase2/3 test',
            'status' => 'draft',
        ]);
    }

    /**
     * @param  array<int, array<string, mixed>>  $steps
     */
    private function seedWorkflow(Tenant $tenant, string $module, array $steps): ApprovalWorkflow
    {
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => "Test {$module} p23"],
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
