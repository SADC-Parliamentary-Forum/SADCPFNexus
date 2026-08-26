<?php

namespace Tests\Feature\Decisions;

use App\Models\Assignment;
use App\Models\MeetingDecision;
use App\Models\MeetingDecisionAction;
use App\Models\MeetingDecisionHistory;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class MeetingResolutionsPhase1Test extends TestCase
{
    private function createDecision(User $user, array $overrides = []): MeetingDecision
    {
        $payload = array_merge([
            'decision_type' => 'resolution',
            'title' => 'Resolution '.uniqid(),
            'body' => 'The Management Committee resolves to…',
            'owner_id' => $user->id,
            'due_date' => now()->addDays(21)->toDateString(),
        ], $overrides);

        $response = $this->asUser($user)->postJson('/api/v1/decisions', $payload);
        $response->assertCreated();

        return MeetingDecision::findOrFail($response->json('data.id'));
    }

    public function test_unique_reference_numbers_per_tenant(): void
    {
        [$http, $user] = $this->asGovernanceOfficer();

        $a = $this->createDecision($user, ['title' => 'First']);
        $b = $this->createDecision($user, ['title' => 'Second']);

        $this->assertNotSame($a->reference_number, $b->reference_number);
        $this->assertMatchesRegularExpression('/^DEC\/\d{4}\/\d{5}$/', $a->reference_number);
        $this->assertMatchesRegularExpression('/^DEC\/\d{4}\/\d{5}$/', $b->reference_number);

        $year = now()->format('Y');
        $this->assertSame("DEC/{$year}/00001", $a->reference_number);
        $this->assertSame("DEC/{$year}/00002", $b->reference_number);
    }

    public function test_assignment_from_resolution_is_idempotent(): void
    {
        $tenant = Tenant::factory()->create();
        $drafter = $this->makeGovernanceOfficer($tenant);
        $owner = $this->makeUser('staff', $tenant);
        $adopter = $this->makeGovernanceOfficer($tenant);

        $decision = $this->createDecision($drafter, [
            'owner_id' => $owner->id,
            'title' => 'Adopted for assignment',
        ]);

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/adopt", [
            'adoption_notes' => 'Adopted in session',
        ])->assertOk();

        $first = $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/create-assignment", [
            'assigned_to' => $owner->id,
            'due_date' => now()->addDays(10)->toDateString(),
            'source_purpose' => 'implementation',
        ]);
        $first->assertCreated();
        $assignmentId = $first->json('data.id');

        $second = $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/create-assignment", [
            'assigned_to' => $owner->id,
            'due_date' => now()->addDays(10)->toDateString(),
            'source_purpose' => 'implementation',
        ]);
        $second->assertCreated();
        $this->assertSame($assignmentId, $second->json('data.id'));

        $this->assertSame(1, Assignment::where('tenant_id', $tenant->id)
            ->where('source_type', 'meeting_decision')
            ->where('source_id', $decision->id)
            ->where('source_purpose', 'implementation')
            ->count());
    }

    public function test_cannot_close_with_open_critical_actions_when_configured(): void
    {
        config(['decisions.block_close_with_open_critical_actions' => true]);

        $tenant = Tenant::factory()->create();
        $drafter = $this->makeGovernanceOfficer($tenant);
        $owner = $this->makeUser('staff', $tenant);
        $adopter = $this->makeGovernanceOfficer($tenant);

        $decision = $this->createDecision($drafter, ['owner_id' => $owner->id]);

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/adopt")->assertOk();
        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/start-progress")->assertOk();

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/actions", [
            'description' => 'Critical follow-up',
            'priority' => 'critical',
            'owner_id' => $owner->id,
            'due_date' => now()->addDays(5)->toDateString(),
            'create_assignment' => false,
        ])->assertCreated();

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/mark-implemented")->assertOk();

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/close", [
            'closure_notes' => 'Trying to close early',
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['actions']);

        MeetingDecisionAction::where('meeting_decision_id', $decision->id)->update([
            'status' => 'completed',
            'completed_at' => now(),
        ]);

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/close", [
            'closure_notes' => 'All critical actions done',
        ])->assertOk()
            ->assertJsonPath('data.status', 'closed');
    }

    public function test_creator_cannot_self_adopt_without_admin_authority(): void
    {
        $tenant = Tenant::factory()->create();
        $drafter = $this->makeGovernanceOfficer($tenant);
        $owner = $this->makeUser('staff', $tenant);
        $adopter = $this->makeGovernanceOfficer($tenant);

        $decision = $this->createDecision($drafter, ['owner_id' => $owner->id]);

        // Drafter has no adopt permission via staff role alone for SoD path —
        // even if they somehow get adopt, service blocks self-adopt.
        $drafter->givePermissionTo('decisions.adopt');

        $this->asUser($drafter)->postJson("/api/v1/decisions/{$decision->id}/adopt")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['adopted_by']);

        // Owner with adopt still blocked.
        $owner->givePermissionTo('decisions.adopt');
        $this->asUser($owner)->postJson("/api/v1/decisions/{$decision->id}/adopt")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['adopted_by']);

        $this->asUser($adopter)->postJson("/api/v1/decisions/{$decision->id}/adopt", [
            'adoption_notes' => 'Independent adoption',
        ])->assertOk()
            ->assertJsonPath('data.status', 'adopted')
            ->assertJsonPath('data.adopted_by', $adopter->id);

        $this->assertDatabaseHas('meeting_decision_history', [
            'meeting_decision_id' => $decision->id,
            'change_type' => 'adopted',
            'to_status' => 'adopted',
        ]);

        $history = MeetingDecisionHistory::where('meeting_decision_id', $decision->id)
            ->where('change_type', 'adopted')
            ->first();
        $this->assertNotNull($history);
        $this->assertNotEmpty($history->hash);
    }

    public function test_system_admin_may_bypass_adoption_sod(): void
    {
        [$http, $admin] = $this->asAdmin();

        $decision = $this->createDecision($admin, [
            'owner_id' => $admin->id,
            'title' => 'Admin draft',
        ]);

        $http->postJson("/api/v1/decisions/{$decision->id}/adopt", [
            'adoption_notes' => 'Admin authority',
        ])->assertOk()
            ->assertJsonPath('data.status', 'adopted');
    }
}
