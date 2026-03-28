<?php

namespace Tests\Feature\Leave;

use App\Models\LeaveRequest;
use App\Models\Tenant;
use Tests\TestCase;

class LeaveRequestTest extends TestCase
{
    private function leavePayload(array $overrides = []): array
    {
        return array_merge([
            'leave_type'  => 'annual',
            'start_date'  => now()->addDays(7)->toDateString(),
            'end_date'    => now()->addDays(9)->toDateString(),
            'reason'      => 'Family commitment',
        ], $overrides);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/leave/requests')->assertUnauthorized();
    }

    public function test_staff_can_create_a_leave_request(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/leave/requests', $this->leavePayload());

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.leave_type', 'annual');

        $this->assertDatabaseHas('leave_requests', [
            'requester_id' => $user->id,
            'leave_type'   => 'annual',
            'status'       => 'draft',
        ]);
    }

    public function test_creating_request_requires_mandatory_fields(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/leave/requests', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['leave_type', 'start_date', 'end_date']);
    }

    public function test_invalid_leave_type_is_rejected(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/leave/requests', $this->leavePayload(['leave_type' => 'holiday']))
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['leave_type']);
    }

    public function test_end_date_must_not_be_before_start_date(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/leave/requests', $this->leavePayload([
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date'   => now()->addDays(5)->toDateString(),
        ]))->assertUnprocessable()
           ->assertJsonValidationErrors(['end_date']);
    }

    public function test_staff_can_submit_their_draft(): void
    {
        [$http, $user] = $this->asStaff();

        $create = $http->postJson('/api/v1/leave/requests', $this->leavePayload());
        $create->assertCreated();
        $id = $create->json('data.id');

        $submit = $http->postJson("/api/v1/leave/requests/{$id}/submit");
        $submit->assertOk()
               ->assertJsonPath('data.status', 'submitted');
    }

    public function test_staff_only_see_their_own_requests(): void
    {
        $tenant = Tenant::factory()->create();

        [$http, $myUser] = $this->asStaff($tenant);
        $otherUser = $this->makeUser('staff', $tenant);

        LeaveRequest::factory()->create(['tenant_id' => $tenant->id, 'requester_id' => $otherUser->id]);
        LeaveRequest::factory()->create(['tenant_id' => $tenant->id, 'requester_id' => $myUser->id]);

        $response = $http->getJson('/api/v1/leave/requests');
        $response->assertOk();

        $requesterIds = collect($response->json('data'))->pluck('requester_id')->unique()->values();
        $this->assertCount(1, $requesterIds);
        $this->assertEquals($myUser->id, $requesterIds->first());
    }

    public function test_hr_manager_can_list_all_leave_requests(): void
    {
        $tenant = Tenant::factory()->create();

        $staffA = $this->makeUser('staff', $tenant);
        $staffB = $this->makeUser('staff', $tenant);

        LeaveRequest::factory()->create(['tenant_id' => $tenant->id, 'requester_id' => $staffA->id]);
        LeaveRequest::factory()->create(['tenant_id' => $tenant->id, 'requester_id' => $staffB->id]);

        $hrManager = $this->makeUser('HR Manager', $tenant);
        $response  = $this->asUser($hrManager)->getJson('/api/v1/leave/requests');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_staff_cannot_delete_a_submitted_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $leave = LeaveRequest::factory()->submitted()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $user->id,
        ]);

        $http->deleteJson("/api/v1/leave/requests/{$leave->id}")
             ->assertStatus(422);
    }
}
