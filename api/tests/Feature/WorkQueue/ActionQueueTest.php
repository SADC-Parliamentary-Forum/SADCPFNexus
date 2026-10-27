<?php

namespace Tests\Feature\WorkQueue;

use App\Models\ApprovalWorkflow;
use App\Models\Assignment;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Services\WorkflowService;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

/**
 * GET /me/action-queue aggregates the caller's own work and never shows
 * another user's or another tenant's items.
 */
class ActionQueueTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
        $this->tenant = Tenant::factory()->create();
    }

    private function queueFor(User $user): array
    {
        return $this->actingAs($user, 'sanctum')->getJson('/api/v1/me/action-queue')->assertOk()->json();
    }

    private function leaveAwaiting(User $staff, User $approver): array
    {
        $wf = ApprovalWorkflow::updateOrCreate(
            ['tenant_id' => $this->tenant->id, 'name' => 'Queue leave'],
            ['module_type' => 'leave', 'is_active' => true, 'definition_status' => 'published']
        );
        $wf->steps()->delete();
        $wf->steps()->create([
            'approver_type' => 'specific_user', 'user_id' => $approver->id, 'stage_type' => 'approve',
            'step_order' => 0, 'actor_selector' => 'specific_user', 'allow_return' => true,
        ]);
        $leave = LeaveRequest::create([
            'tenant_id' => $this->tenant->id, 'requester_id' => $staff->id, 'reference_number' => 'LV-Q-'.uniqid(),
            'leave_type' => 'annual', 'start_date' => now()->addDays(5)->toDateString(),
            'end_date' => now()->addDays(6)->toDateString(), 'days_requested' => 2, 'reason' => 'Queue test', 'status' => 'draft',
        ]);
        $approval = app(WorkflowService::class)->initiate($leave, 'leave', $staff);

        return [$leave, $approval];
    }

    private function assignment(User $assignee, array $extra = []): Assignment
    {
        return Assignment::create(array_merge([
            'tenant_id' => $assignee->tenant_id, 'title' => 'Task '.uniqid(), 'description' => 'Queue',
            'status' => 'active', 'priority' => 'medium', 'created_by' => $assignee->id,
            'assigned_to' => $assignee->id, 'is_template' => false, 'due_date' => now()->addDays(7)->toDateString(),
        ], $extra));
    }

    public function test_pending_approval_appears_only_for_the_assigned_approver(): void
    {
        $staff = $this->makeUser('staff', $this->tenant);
        $manager = $this->makeHrManager($this->tenant);
        [$leave] = $this->leaveAwaiting($staff, $manager);

        $managerQueue = $this->queueFor($manager);
        $approval = collect($managerQueue['data'])->firstWhere('kind', 'approval');
        $this->assertNotNull($approval, 'approver does not see the pending approval');
        $this->assertSame('leave', $approval['module']);
        $this->assertSame($leave->id, $approval['record_id']);
        $this->assertSame('you', $approval['next_step_owner']);

        $staffQueue = $this->queueFor($staff);
        $this->assertNull(collect($staffQueue['data'])->firstWhere('kind', 'approval'), 'requester sees the approver\'s task');
    }

    public function test_returned_request_is_a_blocker_for_its_requester_only(): void
    {
        $staff = $this->makeUser('staff', $this->tenant);
        $manager = $this->makeHrManager($this->tenant);
        [, $approval] = $this->leaveAwaiting($staff, $manager);
        app(WorkflowService::class)->returnForCorrection($approval->fresh(), $manager, 'Dates overlap a closure');

        $correction = collect($this->queueFor($staff)['data'])->firstWhere('kind', 'correction');
        $this->assertNotNull($correction);
        $this->assertStringContainsString('Dates overlap a closure', $correction['blocker']);
        $this->assertSame('resubmit', $correction['action']);

        $this->assertNull(collect($this->queueFor($manager)['data'])->firstWhere('kind', 'correction'));
    }

    public function test_only_my_open_assignments_are_listed_overdue_first(): void
    {
        $me = $this->makeUser('staff', $this->tenant);
        $colleague = $this->makeUser('staff', $this->tenant);
        $later = $this->assignment($me, ['title' => 'Later']);
        $overdue = $this->assignment($me, ['title' => 'Overdue', 'due_date' => now()->subDays(2)->toDateString()]);
        $this->assignment($me, ['title' => 'Done', 'status' => 'completed']);
        $this->assignment($colleague, ['title' => 'Theirs']);

        $queue = $this->queueFor($me);
        $titles = collect($queue['data'])->where('kind', 'assignment')->pluck('title')->all();

        $this->assertSame(['Overdue', 'Later'], $titles);
        $this->assertTrue(collect($queue['data'])->firstWhere('title', 'Overdue')['overdue']);
        $this->assertSame('/assignments/'.$overdue->id, collect($queue['data'])->firstWhere('title', 'Overdue')['path']);
        $this->assertGreaterThanOrEqual(1, $queue['counts']['overdue']);
        $this->assertSame('/assignments/'.$later->id, collect($queue['data'])->firstWhere('title', 'Later')['path']);
    }

    public function test_another_tenants_user_sees_none_of_this_tenants_work(): void
    {
        $staff = $this->makeUser('staff', $this->tenant);
        $manager = $this->makeHrManager($this->tenant);
        $this->leaveAwaiting($staff, $manager);
        $this->assignment($manager);

        $outsider = $this->makeHrManager(Tenant::factory()->create());
        $queue = $this->queueFor($outsider);

        $this->assertSame([], $queue['data']);
        $this->assertSame(0, $queue['counts']['total']);
    }
}
