<?php

namespace Tests\Feature\WorkflowEngine;

use App\Models\ApprovalHistory;
use App\Models\ApprovalWorkflow;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Models\WorkflowEngine\WorkflowDecision;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Queue;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

/**
 * Concurrent and replayed approval actions. A "stale" model is one loaded
 * before another actor's transition committed — exactly what two
 * simultaneous HTTP requests each hold. WorkflowService must lock, reload
 * and revalidate instead of trusting that copy.
 */
class WorkflowTransitionAtomicityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function service(): WorkflowService
    {
        return app(WorkflowService::class);
    }

    public function test_reject_from_a_stale_stage_is_refused_after_another_approver_advanced_it(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $finance = $this->makeHrManager($tenant);
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
            ['approver_type' => 'specific_user', 'user_id' => $finance->id, 'stage_type' => 'approve'],
        ]);
        $approval = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);

        $staleCopy = $approval->fresh();
        $this->service()->approve($approval->fresh(), $manager, 'stage 1 ok');

        try {
            $this->service()->reject($staleCopy, $manager, 'too late');
            $this->fail('Stale reject was accepted');
        } catch (ValidationException $e) {
            $this->assertStringContainsString('moved to another approval stage', $e->getMessage());
        }

        $approval->refresh();
        $this->assertSame('pending', $approval->status);
        $this->assertSame(1, (int) $approval->current_step_index);
        $this->assertSame(0, ApprovalHistory::where('approval_request_id', $approval->id)->where('action', 'reject')->count());
    }

    public function test_second_concurrent_reject_does_not_duplicate_history_or_finalisation(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
        ]);
        $approval = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);

        $first = $approval->fresh();
        $second = $approval->fresh();
        $this->service()->reject($first, $manager, 'first reject');

        $this->expectException(ValidationException::class);
        try {
            $this->service()->reject($second, $manager, 'second reject');
        } finally {
            $this->assertSame(1, ApprovalHistory::where('approval_request_id', $approval->id)->where('action', 'reject')->count());
            $this->assertSame(1, WorkflowDecision::where('approval_request_id', $approval->id)->where('decision_type', 'reject')->count());
            $this->assertSame('rejected', $approval->fresh()->status);
        }
    }

    public function test_replayed_final_approval_does_not_rerun_approvable_finalisation(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
        ]);
        $leave = $this->makeLeave($tenant, $staff);
        $approval = $this->service()->initiate($leave, 'leave', $staff);

        $staleCopy = $approval->fresh();
        $first = $this->service()->approve($approval->fresh(), $manager, 'approved', 'idem-final-1');
        $this->assertSame('approved', $approval->fresh()->status);

        // Sentinel: if the replay re-ran onWorkflowApproved (where financial
        // effects such as leave-balance deduction live) this would flip back.
        LeaveRequest::whereKey($leave->id)->update(['status' => 'replay-sentinel']);

        $replay = $this->service()->approve($staleCopy, $manager, 'approved again', 'idem-final-1');

        $this->assertSame($first['decision_id'], $replay['decision_id']);
        $this->assertSame('replay-sentinel', $leave->fresh()->status);
        $this->assertSame(1, WorkflowDecision::where('approval_request_id', $approval->id)->count());
        $this->assertSame(1, ApprovalHistory::where('approval_request_id', $approval->id)->where('action', 'approve')->count());
    }

    public function test_replayed_reject_is_a_no_op(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
        ]);
        $approval = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);

        $staleCopy = $approval->fresh();
        $this->service()->reject($approval->fresh(), $manager, 'no', 'idem-reject-1');
        $this->service()->reject($staleCopy, $manager, 'no', 'idem-reject-1');

        $this->assertSame(1, ApprovalHistory::where('approval_request_id', $approval->id)->where('action', 'reject')->count());
        $this->assertSame('rejected', $approval->fresh()->status);
    }

    public function test_withdraw_from_a_stale_copy_after_final_approval_is_refused(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
        ]);
        $approval = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);

        $staleCopy = $approval->fresh();
        $this->service()->approve($approval->fresh(), $manager, 'approved');

        $this->expectException(ValidationException::class);
        try {
            $this->service()->withdraw($staleCopy, $staff);
        } finally {
            $this->assertSame('approved', $approval->fresh()->status);
            $this->assertSame(0, ApprovalHistory::where('approval_request_id', $approval->id)->where('action', 'withdraw')->count());
        }
    }

    public function test_return_from_a_stale_copy_after_rejection_is_refused(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve', 'allow_return' => true],
        ]);
        $approval = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);

        $staleCopy = $approval->fresh();
        $this->service()->reject($approval->fresh(), $manager, 'no');

        $this->expectException(ValidationException::class);
        try {
            $this->service()->returnForCorrection($staleCopy, $manager, 'fix it');
        } finally {
            $this->assertSame('rejected', $approval->fresh()->status);
        }
    }

    public function test_another_users_idempotency_key_is_refused_not_replayed(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
        ]);
        $approval = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);
        $this->service()->approve($approval->fresh(), $manager, 'approved', 'mgr-key-1');

        // A different user presenting that key must neither get the stored
        // decision back nor a silent success.
        $intruder = $this->makeUser('staff', $tenant);
        $this->expectException(ValidationException::class);
        $this->service()->reject($approval->fresh(), $intruder, 'mine now', 'mgr-key-1');
    }

    public function test_reusing_a_key_on_a_different_request_is_refused(): void
    {
        [$tenant, $staff, $manager] = $this->actors();
        $this->seedWorkflow($tenant, [
            ['approver_type' => 'specific_user', 'user_id' => $manager->id, 'stage_type' => 'approve'],
        ]);
        $first = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);
        $second = $this->service()->initiate($this->makeLeave($tenant, $staff), 'leave', $staff);
        $this->service()->approve($first->fresh(), $manager, 'ok', 'reused-key');

        try {
            $this->service()->reject($second->fresh(), $manager, 'should not be swallowed', 'reused-key');
            $this->fail('Reused key silently skipped a different decision');
        } catch (ValidationException $e) {
            $this->assertArrayHasKey('idempotency_key', $e->errors());
        }
        $this->assertSame('pending', $second->fresh()->status);
    }

    /** @return array{0: Tenant, 1: User, 2: User} */
    private function actors(): array
    {
        $tenant = Tenant::factory()->create();

        return [$tenant, $this->makeUser('staff', $tenant), $this->makeHrManager($tenant)];
    }

    private function makeLeave(Tenant $tenant, User $staff): LeaveRequest
    {
        return LeaveRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'reference_number' => 'LV-ATOM-'.uniqid(),
            'leave_type' => 'annual',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(),
            'days_requested' => 2,
            'reason' => 'Atomicity test',
            'status' => 'draft',
        ]);
    }

    /** @param array<int, array<string, mixed>> $steps */
    private function seedWorkflow(Tenant $tenant, array $steps): void
    {
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $tenant->id, 'name' => 'Atomicity leave'],
            ['module_type' => 'leave', 'is_active' => true, 'definition_status' => 'published']
        );
        $wf->steps()->delete();
        foreach ($steps as $i => $step) {
            $wf->steps()->create($step + ['step_order' => $i, 'actor_selector' => $step['approver_type']]);
        }
    }
}
