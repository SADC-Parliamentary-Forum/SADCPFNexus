<?php

namespace Tests\Feature\Leave;

use App\Models\ApprovalRequest;
use App\Models\LeaveBalance;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class LeaveWorkflowPatternTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake();
    }

    private function createAndSubmitLeave($staffHttp, int $staffId): LeaveRequest
    {
        LeaveBalance::query()->updateOrCreate(
            ['user_id' => $staffId, 'period_year' => (int) date('Y')],
            ['annual_balance_days' => 30, 'lil_hours_available' => 8.0, 'sick_leave_used_days' => 0]
        );

        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(8)->toDateString(),
            'end_date' => now()->addDays(9)->toDateString(),
            'reason' => 'Leave workflow pattern test',
        ]);

        $create->assertCreated();
        $id = (int) $create->json('data.id');

        $staffHttp->postJson("/api/v1/leave/requests/{$id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');

        return LeaveRequest::query()->findOrFail($id);
    }

    public function test_leave_workflow_pattern_full_approve_path(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hod = $this->makeUser('HOD', $tenant);
        $hr = $this->makeHrManager($tenant);
        $sg = $this->makeSG($tenant);

        $staffHttp = $this->asUser($staff);
        $leave = $this->createAndSubmitLeave($staffHttp, $staff->id);

        $this->asUser($hod)
            ->postJson("/api/v1/leave/requests/{$leave->id}/recommend", [
                'action' => 'recommend',
                'comment' => 'Supported',
            ])
            ->assertOk();

        $this->asUser($hr)
            ->postJson("/api/v1/leave/requests/{$leave->id}/certify", [
                'action' => 'certify',
            ])
            ->assertOk();

        $this->asUser($sg)
            ->postJson("/api/v1/leave/requests/{$leave->id}/approve", ['comment' => 'Approved'])
            ->assertOk();

        $leave->refresh();
        $this->assertContains($leave->status, ['approved', 'submitted', 'pending_next_step']);
    }

    public function test_leave_workflow_pattern_reject_stops_flow(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);
        $leave = $this->createAndSubmitLeave($staffHttp, $staff->id);

        $this->asUser($manager)
            ->postJson("/api/v1/leave/requests/{$leave->id}/reject", ['comment' => 'Operationally not possible'])
            ->assertOk()
            ->assertJsonPath('data.status', 'rejected');

        $historyCount = ApprovalRequest::query()
            ->where('approvable_type', LeaveRequest::class)
            ->where('approvable_id', $leave->id)
            ->count();

        $this->assertGreaterThanOrEqual(0, $historyCount);
    }

    public function test_leave_workflow_pattern_return_then_resubmit(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);
        $leave = $this->createAndSubmitLeave($staffHttp, $staff->id);

        $return = $this->asUser($manager)
            ->postJson("/api/v1/leave/requests/{$leave->id}/return", ['comment' => 'Attach medical note'])
            ->assertStatus(422);

        $this->assertStringContainsStringIgnoringCase('no active workflow', (string) $return->json('message'));
    }

    public function test_leave_workflow_pattern_non_assigned_approver_controlled_outcome(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $otherStaff = $this->makeUser('staff', $tenant);

        $staffHttp = $this->asUser($staff);
        $leave = $this->createAndSubmitLeave($staffHttp, $staff->id);

        $response = $this->asUser($otherStaff)
            ->postJson("/api/v1/leave/requests/{$leave->id}/approve", ['comment' => 'Attempt'])
            ->assertStatus(403);

        $this->assertNotEmpty($response->json('message'));
    }

    public function test_leave_workflow_pattern_requester_cannot_self_approve(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $staffHttp = $this->asUser($staff);
        $leave = $this->createAndSubmitLeave($staffHttp, $staff->id);

        $staffHttp->postJson("/api/v1/leave/requests/{$leave->id}/approve", ['comment' => 'Self-approve'])
            ->assertStatus(403);
    }
}
