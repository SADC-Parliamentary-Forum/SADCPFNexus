<?php

namespace Tests\Feature\Travel;

use App\Models\Tenant;
use App\Models\TravelRequest;
use Tests\TestCase;

class TravelRegisterActionsTest extends TestCase
{
    public function test_owner_can_update_draft_request(): void
    {
        [$http, $user] = $this->asStaff();

        $create = $http->postJson('/api/v1/travel/requests', [
            'purpose' => 'Regional workshop',
            'departure_date' => now()->addDays(10)->toDateString(),
            'return_date' => now()->addDays(14)->toDateString(),
            'destination_country' => 'Botswana',
            'destination_city' => 'Gaborone',
            'currency' => 'NAD',
        ]);
        $create->assertCreated();
        $id = $create->json('data.id');

        $http->putJson("/api/v1/travel/requests/{$id}", [
            'purpose' => 'Regional workshop (revised)',
            'destination_country' => 'Zambia',
            'destination_city' => 'Lusaka',
        ])
            ->assertOk()
            ->assertJsonPath('data.purpose', 'Regional workshop (revised)')
            ->assertJsonPath('data.destination_country', 'Zambia');

        $this->assertDatabaseHas('travel_requests', [
            'id' => $id,
            'requester_id' => $user->id,
            'purpose' => 'Regional workshop (revised)',
            'destination_country' => 'Zambia',
        ]);
    }

    public function test_owner_can_delete_draft_but_not_submitted_request(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);

        $draft = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'status' => 'draft',
        ]);

        $this->asUser($owner)
            ->deleteJson("/api/v1/travel/requests/{$draft->id}")
            ->assertOk()
            ->assertJsonPath('message', 'Travel request deleted.');

        $this->assertSoftDeleted('travel_requests', ['id' => $draft->id]);

        $submitted = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'status' => 'submitted',
        ]);

        $this->asUser($owner)
            ->deleteJson("/api/v1/travel/requests/{$submitted->id}")
            ->assertUnprocessable();
    }

    public function test_owner_can_cancel_approved_request_with_reason(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'status' => 'approved',
        ]);

        $this->asUser($owner)
            ->postJson("/api/v1/travel/requests/{$travel->id}/cancel", [
                'reason' => 'Mission postponed by host.',
            ])
            ->assertOk()
            ->assertJsonPath('data.status', 'cancelled');

        $this->assertDatabaseHas('travel_requests', [
            'id' => $travel->id,
            'status' => 'cancelled',
            'cancellation_reason' => 'Mission postponed by host.',
        ]);
    }

    public function test_other_staff_cannot_delete_or_update_foreign_draft(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);

        $draft = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $owner->id,
            'status' => 'draft',
            'purpose' => 'Owner purpose',
        ]);

        $this->asUser($other)
            ->putJson("/api/v1/travel/requests/{$draft->id}", [
                'purpose' => 'Hijacked purpose',
            ])
            ->assertForbidden();

        $this->asUser($other)
            ->deleteJson("/api/v1/travel/requests/{$draft->id}")
            ->assertForbidden();

        $this->assertDatabaseHas('travel_requests', [
            'id' => $draft->id,
            'purpose' => 'Owner purpose',
            'deleted_at' => null,
        ]);
    }

    public function test_register_export_returns_rows_for_privileged_viewer(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'purpose' => 'Exportable mission',
            'destination_country' => 'Namibia',
        ]);

        $this->asUser($hr)
            ->getJson('/api/v1/travel/register/export')
            ->assertOk()
            ->assertJsonFragment(['purpose' => 'Exportable mission']);
    }
}
