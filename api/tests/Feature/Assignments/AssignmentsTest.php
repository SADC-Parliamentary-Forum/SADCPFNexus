<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\Tenant;
use Tests\TestCase;

class AssignmentsTest extends TestCase
{
    private function assignmentPayload(array $overrides = []): array
    {
        return array_merge([
            'title'       => 'Review Q1 Programme Report',
            'description' => 'Review and approve the Q1 programme report.',
            'priority'    => 'medium',
            'due_date'    => now()->addDays(14)->toDateString(),
        ], $overrides);
    }

    public function test_unauthenticated_cannot_list_assignments(): void
    {
        $this->getJson('/api/v1/assignments')->assertUnauthorized();
    }

    public function test_staff_can_list_assignments(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/assignments')->assertOk();
    }

    public function test_staff_can_create_assignment(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/assignments', $this->assignmentPayload());

        $response->assertCreated();
        $this->assertDatabaseHas('assignments', [
            'title'      => 'Review Q1 Programme Report',
            'created_by' => $user->id,
        ]);
    }

    public function test_assignment_requires_title(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/assignments', [
            'description' => 'No title given',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_staff_can_view_own_assignment(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $assignment = Assignment::create([
            'tenant_id'   => $tenant->id,
            'created_by'  => $user->id,
            'title'       => 'My assignment',
            'description' => 'My assignment details.',
            'due_date'    => now()->addDays(14)->toDateString(),
            'status'      => 'draft',
            'priority'    => 'medium',
        ]);

        $http->getJson("/api/v1/assignments/{$assignment->id}")->assertOk();
    }

    public function test_assignments_stats_endpoint_returns_data(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/assignments/stats')
             ->assertOk()
             ->assertJsonStructure(['total', 'pending', 'in_progress', 'completed']);
    }

    public function test_creator_can_update_pending_assignment(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $assignment = Assignment::create([
            'tenant_id'   => $tenant->id,
            'created_by'  => $user->id,
            'title'       => 'Original',
            'description' => 'Original description.',
            'due_date'    => now()->addDays(14)->toDateString(),
            'status'      => 'draft',
            'priority'    => 'low',
        ]);

        $http->putJson("/api/v1/assignments/{$assignment->id}", [
            'title'    => 'Updated title',
            'priority' => 'high',
        ])->assertOk();

        $this->assertDatabaseHas('assignments', [
            'id'       => $assignment->id,
            'title'    => 'Updated title',
            'priority' => 'high',
        ]);
    }
}
