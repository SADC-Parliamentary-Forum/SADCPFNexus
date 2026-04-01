<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ProgrammesTest extends TestCase
{
    private function programmePayload(array $overrides = []): array
    {
        return array_merge([
            'title'       => 'SRHR Advocacy Programme 2026',
            'description' => 'Annual SRHR advocacy and capacity building.',
            'start_date'  => now()->addDays(7)->toDateString(),
            'end_date'    => now()->addMonths(6)->toDateString(),
            'budget'      => 50000.00,
            'currency'    => 'NAD',
        ], $overrides);
    }

    public function test_unauthenticated_cannot_list_programmes(): void
    {
        $this->getJson('/api/v1/programmes')->assertUnauthorized();
    }

    public function test_staff_can_create_programme(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/programmes', $this->programmePayload());

        $response->assertCreated();
        $this->assertDatabaseHas('programmes', [
            'title'       => 'SRHR Advocacy Programme 2026',
            'requester_id'=> $user->id,
        ]);
    }

    public function test_programme_requires_title(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/programmes', [
            'description' => 'No title',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_staff_can_list_own_programmes(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/programmes')->assertOk();
    }

    public function test_staff_can_view_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = Programme::create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $user->id,
            'title'        => 'Test Programme',
            'status'       => 'draft',
        ]);

        $http->getJson("/api/v1/programmes/{$programme->id}")->assertOk();
    }

    public function test_staff_can_update_draft_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = Programme::create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $user->id,
            'title'        => 'Old Title',
            'status'       => 'draft',
        ]);

        $http->putJson("/api/v1/programmes/{$programme->id}", [
            'title' => 'Updated Title',
        ])->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'    => $programme->id,
            'title' => 'Updated Title',
        ]);
    }

    public function test_staff_can_submit_programme_for_approval(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = Programme::create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $user->id,
            'title'        => 'Submit Me',
            'status'       => 'draft',
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/submit")
             ->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'     => $programme->id,
            'status' => 'submitted',
        ]);
    }

    public function test_admin_can_approve_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $staff = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id'    => $tenant->id,
            'requester_id' => $staff->id,
            'title'        => 'Approve Me',
            'status'       => 'submitted',
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/approve")
             ->assertOk();

        $this->assertDatabaseHas('programmes', [
            'id'     => $programme->id,
            'status' => 'approved',
        ]);
    }
}
