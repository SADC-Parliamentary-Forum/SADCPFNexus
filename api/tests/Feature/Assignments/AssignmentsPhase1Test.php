<?php

namespace Tests\Feature\Assignments;

use App\Models\Assignment;
use App\Models\Department;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class AssignmentsPhase1Test extends TestCase
{
    private function seedPair(?Tenant $tenant = null): array
    {
        $tenant ??= Tenant::factory()->create();
        $creator = $this->makeAdmin($tenant);
        $assignee = User::factory()->create(['tenant_id' => $tenant->id]);
        $assignee->assignRole('staff');
        $reviewer = User::factory()->create(['tenant_id' => $tenant->id]);
        $reviewer->assignRole('staff');

        return [$tenant, $creator, $assignee, $reviewer];
    }

    public function test_issue_requires_primary_assignee_or_department_queue(): void
    {
        [$tenant, $creator] = $this->seedPair();
        $http = $this->actingAs($creator, 'sanctum');

        $id = $http->postJson('/api/v1/assignments/', [
            'title' => 'No owner yet',
            'description' => 'Draft without assignee',
            'due_date' => now()->addDays(5)->toDateString(),
        ])->assertCreated()->json('data.id');

        $http->postJson("/api/v1/assignments/{$id}/issue")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['assigned_to']);
    }

    public function test_completion_does_not_equal_verification_when_review_required(): void
    {
        [$tenant, $creator, $assignee, $reviewer] = $this->seedPair();

        $assignment = Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'assigned_to' => $assignee->id,
            'reviewer_id' => $reviewer->id,
            'review_required' => true,
            'title' => 'Needs review',
            'description' => 'Must be verified',
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => 'active',
            'priority' => 'medium',
        ]);

        $this->actingAs($assignee, 'sanctum')
            ->postJson("/api/v1/assignments/{$assignment->id}/complete", ['notes' => 'Done'])
            ->assertOk();

        $assignment->refresh();
        $this->assertSame('completed', $assignment->status);
        $this->assertSame('pending', $assignment->review_status);
        $this->assertNull($assignment->verified_at);

        $this->actingAs($creator, 'sanctum')
            ->postJson("/api/v1/assignments/{$assignment->id}/close", ['notes' => 'skip review'])
            ->assertUnprocessable();
    }

    public function test_blocker_requires_blocker_owner(): void
    {
        [$tenant, $creator, $assignee] = $this->seedPair();
        $blockerOwner = User::factory()->create(['tenant_id' => $tenant->id]);

        $assignment = Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'assigned_to' => $assignee->id,
            'title' => 'Blocked work',
            'description' => 'Waiting',
            'due_date' => now()->addDays(7)->toDateString(),
            'status' => 'active',
            'priority' => 'high',
        ]);

        $this->actingAs($assignee, 'sanctum')
            ->postJson("/api/v1/assignments/{$assignment->id}/block", [
                'blocker_type' => 'waiting_for_information',
                'blocker_details' => 'Need inputs',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['blocker_owner_id']);

        $this->actingAs($assignee, 'sanctum')
            ->postJson("/api/v1/assignments/{$assignment->id}/block", [
                'blocker_type' => 'waiting_for_information',
                'blocker_details' => 'Need inputs',
                'blocker_owner_id' => $blockerOwner->id,
            ])
            ->assertOk();

        $assignment->refresh();
        $this->assertSame('blocked', $assignment->status);
        $this->assertSame($blockerOwner->id, $assignment->blocker_owner_id);
        // Overdue is a deadline axis — must not collapse into work status.
        $this->assertContains($assignment->deadline_state, ['future', 'due_soon', 'due_today', 'overdue']);
        $this->assertNotSame('blocked', $assignment->deadline_state);
    }

    public function test_confidentiality_inherits_from_source(): void
    {
        [$tenant, $creator, $assignee] = $this->seedPair();
        $outsider = User::factory()->create(['tenant_id' => $tenant->id]);
        $outsider->assignRole('staff');

        $created = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/from-source', [
                'title' => 'Secret letter action',
                'description' => 'Sensitive body',
                'due_date' => now()->addDays(5)->toDateString(),
                'assigned_to' => $assignee->id,
                'source_type' => 'correspondence',
                'source_id' => 9001,
                'source_purpose' => 'draft_response',
                'source_confidential' => true,
                'source_title' => 'CONFIDENTIAL DONOR LETTER',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertTrue((bool) $created['is_confidential']);

        $view = $this->actingAs($outsider, 'sanctum')
            ->getJson('/api/v1/assignments/'.$created['id'])
            ->assertOk()
            ->json();

        $this->assertSame('[Confidential]', $view['title']);
        $this->assertStringContainsString('Restricted', $view['description']);
    }

    public function test_source_allow_list_rejects_unknown_types(): void
    {
        [$tenant, $creator, $assignee] = $this->seedPair();

        $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/from-source', [
                'title' => 'Bad source',
                'description' => 'Nope',
                'due_date' => now()->addDays(3)->toDateString(),
                'assigned_to' => $assignee->id,
                'source_type' => 'salesforce',
                'source_id' => 1,
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['source_type']);
    }

    public function test_from_source_create_is_idempotent(): void
    {
        [$tenant, $creator, $assignee] = $this->seedPair();
        $payload = [
            'title' => 'PIF follow-up',
            'description' => 'Complete annex',
            'due_date' => now()->addDays(10)->toDateString(),
            'assigned_to' => $assignee->id,
            'source_type' => 'pif',
            'source_id' => 42,
            'source_purpose' => 'annex_a',
        ];

        $a = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/from-source', $payload)
            ->assertCreated()
            ->json('data.id');

        $b = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/from-source', $payload)
            ->assertCreated()
            ->json('data.id');

        $this->assertSame($a, $b);
        $this->assertSame(1, Assignment::where('source_type', 'pif')->where('source_id', 42)->where('source_purpose', 'annex_a')->count());
    }

    public function test_primary_assignee_cannot_self_verify_when_review_required(): void
    {
        [$tenant, $creator, $assignee, $reviewer] = $this->seedPair();

        $assignment = Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'assigned_to' => $assignee->id,
            'reviewer_id' => $reviewer->id,
            'review_required' => true,
            'title' => 'Self verify blocked',
            'description' => 'Separation of duties',
            'due_date' => now()->addDays(4)->toDateString(),
            'status' => 'completed',
            'review_status' => 'pending',
            'progress_percent' => 100,
            'priority' => 'medium',
        ]);

        $this->actingAs($assignee, 'sanctum')
            ->postJson("/api/v1/assignments/{$assignment->id}/verify", [
                'decision' => 'accepted',
                'comments' => 'I approve myself',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['reviewer']);

        $this->actingAs($reviewer, 'sanctum')
            ->postJson("/api/v1/assignments/{$assignment->id}/verify", [
                'decision' => 'accepted',
                'comments' => 'Looks good',
            ])
            ->assertOk();

        $assignment->refresh();
        $this->assertSame('closed', $assignment->status);
        $this->assertNotNull($assignment->verified_at);
        $this->assertSame($reviewer->id, $assignment->verified_by);
    }

    public function test_recurring_template_generates_separate_instance(): void
    {
        [$tenant, $creator, $assignee] = $this->seedPair();

        $template = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/templates', [
                'title' => 'Weekly registry sweep',
                'description' => 'Clear pending registry items',
                'due_date' => now()->addDays(7)->toDateString(),
                'assigned_to' => $assignee->id,
                'recurrence_rule' => ['frequency' => 'weekly', 'interval' => 1],
            ])
            ->assertCreated()
            ->json('data');

        $this->assertTrue((bool) $template['is_template']);

        $instance = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/'.$template['id'].'/generate', [
                'due_date' => now()->addDays(7)->toDateString(),
            ])
            ->assertCreated()
            ->json('data');

        $this->assertFalse((bool) $instance['is_template']);
        $this->assertSame($template['id'], $instance['template_id']);
        $this->assertNotSame($template['id'], $instance['id']);
        $this->assertSame(1, Assignment::where('template_id', $template['id'])->count());
    }

    public function test_department_queue_sets_claim_deadline(): void
    {
        [$tenant, $creator] = $this->seedPair();
        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Finance',
            'code' => 'FIN-'.uniqid(),
        ]);

        $data = $this->actingAs($creator, 'sanctum')
            ->postJson('/api/v1/assignments/', [
                'title' => 'Finance queue item',
                'description' => 'Needs claim',
                'due_date' => now()->addDays(5)->toDateString(),
                'department_id' => $dept->id,
            ])
            ->assertCreated()
            ->json('data');

        $this->assertNull($data['assigned_to']);
        $this->assertNotNull($data['department_claim_due_at']);
    }

    public function test_weekly_summary_feed_contract(): void
    {
        [$tenant, $creator, $assignee] = $this->seedPair();

        Assignment::create([
            'tenant_id' => $tenant->id,
            'created_by' => $creator->id,
            'assigned_to' => $assignee->id,
            'title' => 'Open work',
            'description' => 'For summary',
            'due_date' => now()->addDays(2)->toDateString(),
            'status' => 'active',
            'priority' => 'medium',
            'is_confidential' => false,
        ]);

        $feed = $this->actingAs($creator, 'sanctum')
            ->getJson('/api/v1/assignments/weekly-summary-feed')
            ->assertOk()
            ->json();

        $this->assertArrayHasKey('counts', $feed);
        $this->assertArrayHasKey('active', $feed);
        $this->assertArrayHasKey('overdue', $feed);
        $this->assertArrayHasKey('blocked', $feed);
        $this->assertArrayHasKey('upcoming_deadlines', $feed);
    }
}
