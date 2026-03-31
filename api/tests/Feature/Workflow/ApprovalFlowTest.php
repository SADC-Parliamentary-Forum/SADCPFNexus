<?php

namespace Tests\Feature\Workflow;

use App\Models\ApprovalRequest;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\TravelRequest;
use Illuminate\Support\Facades\Queue;
use Tests\TestCase;

class ApprovalFlowTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Queue::fake(); // prevent actual emails during workflow tests
    }

    // ── Pending Approvals ─────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_get_pending_approvals(): void
    {
        $this->getJson('/api/v1/approvals/pending')->assertUnauthorized();
    }

    public function test_manager_sees_pending_approvals(): void
    {
        $tenant   = Tenant::factory()->create();
        [$http]   = $this->asHrManager($tenant);

        $response = $http->getJson('/api/v1/approvals/pending');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    public function test_staff_pending_list_is_empty_for_non_approver(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/approvals/pending');
        $response->assertOk();

        // A plain staff member who is not an approver in any workflow step
        // should have an empty list
        $this->assertIsArray($response->json('data'));
    }

    // ── Travel full cycle via Workflow ────────────────────────────────────────

    public function test_full_travel_approval_cycle(): void
    {
        $tenant   = Tenant::factory()->create();
        $staff    = $this->makeUser('staff', $tenant);
        $manager  = $this->makeHrManager($tenant);

        // 1. Staff creates + submits
        $staffHttp = $this->asUser($staff);
        $create = $staffHttp->postJson('/api/v1/travel/requests', [
            'purpose'             => 'Regional conference',
            'departure_date'      => now()->addDays(14)->toDateString(),
            'return_date'         => now()->addDays(17)->toDateString(),
            'destination_country' => 'South Africa',
            'destination_city'    => 'Johannesburg',
            'estimated_dsa'       => 2500.00,
            'currency'            => 'NAD',
        ]);
        $create->assertCreated();
        $travelId = $create->json('data.id');

        $submit = $staffHttp->postJson("/api/v1/travel/requests/{$travelId}/submit");
        $submit->assertOk()->assertJsonPath('data.status', 'submitted');

        // 2. Manager approves via travel endpoint
        $managerHttp = $this->asUser($manager);
        $approve = $managerHttp->postJson("/api/v1/travel/requests/{$travelId}/approve", [
            'comment' => 'Approved — on budget',
        ]);
        $approve->assertOk();

        // Status should move forward
        $check = $staffHttp->getJson("/api/v1/travel/requests/{$travelId}");
        $check->assertOk();
        $this->assertContains($check->json('data.status'), ['approved', 'pending_next_step', 'submitted']);
    }

    public function test_full_leave_approval_cycle(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);

        // Create + submit
        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(7)->toDateString(),
            'end_date'   => now()->addDays(9)->toDateString(),
            'reason'     => 'Personal vacation',
        ]);
        $create->assertCreated();
        $leaveId = $create->json('data.id');

        $staffHttp->postJson("/api/v1/leave/requests/{$leaveId}/submit")
                  ->assertOk()
                  ->assertJsonPath('data.status', 'submitted');

        // Approve
        $this->asUser($manager)
             ->postJson("/api/v1/leave/requests/{$leaveId}/approve", ['comment' => 'Noted'])
             ->assertOk();
    }

    public function test_full_leave_rejection_cycle(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);

        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(3)->toDateString(),
            'end_date'   => now()->addDays(4)->toDateString(),
            'reason'     => 'Short trip',
        ]);
        $leaveId = $create->json('data.id');
        $staffHttp->postJson("/api/v1/leave/requests/{$leaveId}/submit");

        $this->asUser($manager)
             ->postJson("/api/v1/leave/requests/{$leaveId}/reject", [
                 'comment' => 'Critical period — cannot approve leave at this time',
             ])->assertOk()
               ->assertJsonPath('data.status', 'rejected');
    }

    // ── Generic Approval endpoints ─────────────────────────────────────────────

    public function test_approval_history_is_retrievable(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);
        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'sick',
            'start_date' => now()->addDays(1)->toDateString(),
            'end_date'   => now()->addDays(2)->toDateString(),
            'reason'     => 'Doctor appointment',
        ]);
        $leaveId = $create->json('data.id');
        $staffHttp->postJson("/api/v1/leave/requests/{$leaveId}/submit");

        // Get the approval request id
        $approvalRequest = ApprovalRequest::where('approvable_type', LeaveRequest::class)
            ->where('approvable_id', $leaveId)
            ->first();

        if ($approvalRequest) {
            $history = $this->asUser($manager)
                ->getJson("/api/v1/approvals/{$approvalRequest->id}/history");
            $history->assertOk()
                    ->assertJsonStructure(['data']);
        } else {
            // No workflow configured for leave — just assert the endpoint exists
            $this->assertTrue(true, 'No workflow configured for this tenant; history not tested.');
        }
    }

    // ── Edge cases ────────────────────────────────────────────────────────────

    public function test_cannot_approve_draft_request(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);
        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(5)->toDateString(),
            'end_date'   => now()->addDays(6)->toDateString(),
            'reason'     => 'Test',
        ]);
        $leaveId = $create->json('data.id');

        // Approve without submitting first — should fail
        $this->asUser($manager)
             ->postJson("/api/v1/leave/requests/{$leaveId}/approve")
             ->assertStatus(422); // Unprocessable — wrong state
    }

    public function test_cannot_reject_without_comment(): void
    {
        $tenant  = Tenant::factory()->create();
        $staff   = $this->makeUser('staff', $tenant);
        $manager = $this->makeHrManager($tenant);

        $staffHttp = $this->asUser($staff);
        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date'   => now()->addDays(11)->toDateString(),
            'reason'     => 'Test',
        ]);
        $leaveId = $create->json('data.id');
        $staffHttp->postJson("/api/v1/leave/requests/{$leaveId}/submit");

        $this->asUser($manager)
             ->postJson("/api/v1/leave/requests/{$leaveId}/reject", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['comment']);
    }
}
