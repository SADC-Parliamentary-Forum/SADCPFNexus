<?php

namespace Tests\Feature\Travel;

use App\Models\Tenant;
use App\Models\TravelRequest;
use Tests\TestCase;

class TravelRequestTest extends TestCase
{
    private function travelPayload(array $overrides = []): array
    {
        return array_merge([
            'purpose'             => 'Attend regional meeting',
            'departure_date'      => now()->addDays(7)->toDateString(),
            'return_date'         => now()->addDays(10)->toDateString(),
            'destination_country' => 'Namibia',
            'destination_city'    => 'Windhoek',
            'estimated_dsa'       => 1500.00,
            'currency'            => 'NAD',
        ], $overrides);
    }

    public function test_unauthenticated_request_is_rejected(): void
    {
        $this->getJson('/api/v1/travel/requests')->assertUnauthorized();
    }

    public function test_staff_can_create_a_travel_request(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/travel/requests', $this->travelPayload());

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.destination_country', 'Namibia');

        $this->assertDatabaseHas('travel_requests', [
            'requester_id' => $user->id,
            'status'       => 'draft',
        ]);
    }

    public function test_creating_request_requires_mandatory_fields(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/requests', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['purpose', 'departure_date', 'return_date', 'destination_country']);
    }

    public function test_return_date_must_not_be_before_departure(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'departure_date' => now()->addDays(10)->toDateString(),
            'return_date'    => now()->addDays(5)->toDateString(),
        ]))->assertUnprocessable()
           ->assertJsonValidationErrors(['return_date']);
    }

    public function test_staff_can_list_only_their_own_requests(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $myUser] = $this->asStaff($tenant);

        // Create a request belonging to a different user in the same tenant
        $otherUser = $this->makeUser('staff', $tenant);
        TravelRequest::factory()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $otherUser->id,
            'status'       => 'draft',
        ]);
        TravelRequest::factory()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $myUser->id,
            'status'       => 'draft',
        ]);

        $response = $http->getJson('/api/v1/travel/requests');
        $response->assertOk();

        // Staff should only see their own request (1), not the other user's
        $ids = collect($response->json('data'))->pluck('requester_id')->unique()->values();
        $this->assertCount(1, $ids);
        $this->assertEquals($myUser->id, $ids->first());
    }

    public function test_hr_manager_can_see_all_requests_in_tenant(): void
    {
        $tenant = Tenant::factory()->create();

        $staffA = $this->makeUser('staff', $tenant);
        $staffB = $this->makeUser('staff', $tenant);

        TravelRequest::factory()->create(['tenant_id' => $tenant->id, 'requester_id' => $staffA->id]);
        TravelRequest::factory()->create(['tenant_id' => $tenant->id, 'requester_id' => $staffB->id]);

        $hrManager = $this->makeUser('HR Manager', $tenant);
        $response  = $this->asUser($hrManager)->getJson('/api/v1/travel/requests');

        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_staff_cannot_see_another_tenants_requests(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $userA = $this->makeUser('staff', $tenantA);
        $userB = $this->makeUser('staff', $tenantB);

        TravelRequest::factory()->create(['tenant_id' => $tenantB->id, 'requester_id' => $userB->id]);

        $response = $this->asUser($userA)->getJson('/api/v1/travel/requests');
        $response->assertOk();

        // Tenant A user sees none (the only record belongs to tenant B)
        $this->assertCount(0, $response->json('data'));
    }

    public function test_staff_can_submit_their_draft_request(): void
    {
        [$http, $user] = $this->asStaff();

        // Create draft via API
        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $create->assertCreated();
        $id = $create->json('data.id');

        // Submit it
        $submit = $http->postJson("/api/v1/travel/requests/{$id}/submit");
        $submit->assertOk()
               ->assertJsonPath('data.status', 'submitted');
    }

    public function test_staff_cannot_submit_another_users_draft(): void
    {
        $tenant = Tenant::factory()->create();

        $owner = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $owner->id,
            'status'       => 'draft',
        ]);

        // Another staff member tries to submit the owner's request
        $this->asUser($other)
             ->postJson("/api/v1/travel/requests/{$travel->id}/submit")
             ->assertForbidden();
    }
}
