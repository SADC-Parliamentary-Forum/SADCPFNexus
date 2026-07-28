<?php

namespace Tests\Feature\Risk;

use App\Models\Assignment;
use App\Models\Risk;
use App\Models\RiskAcceptance;
use App\Models\RiskAction;
use App\Models\RiskAssessment;
use App\Models\StrategicGoal;
use App\Models\StrategicObjective;
use App\Models\StrategicPlan;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class RiskRegisterPhase1Test extends TestCase
{
    private function makeObjective(int $tenantId): StrategicObjective
    {
        $plan = StrategicPlan::create([
            'tenant_id' => $tenantId,
            'name' => 'Plan '.uniqid(),
            'status' => 'active',
        ]);
        $goal = StrategicGoal::create([
            'tenant_id' => $tenantId,
            'strategic_plan_id' => $plan->id,
            'title' => 'Goal',
        ]);

        return StrategicObjective::create([
            'tenant_id' => $tenantId,
            'strategic_goal_id' => $goal->id,
            'title' => 'Objective',
            'code' => 'OBJ-'.uniqid(),
        ]);
    }

    private function createReadyRisk(User $user, array $overrides = []): Risk
    {
        $objective = $this->makeObjective($user->tenant_id);

        $payload = array_merge([
            'title' => 'Phase1 risk '.uniqid(),
            'description' => 'Description of risk to objective',
            'category' => 'operational',
            'likelihood' => 3,
            'impact' => 4,
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $user->id,
            'cause' => 'Cause',
            'event_description' => 'Event',
            'consequence' => 'Consequence',
        ], $overrides);

        $response = $this->asUser($user)->postJson('/api/v1/risk/risks', $payload);
        $response->assertCreated();

        return Risk::findOrFail($response->json('data.id'));
    }

    public function test_objective_required_before_submit(): void
    {
        [$http, $user] = $this->asStaff();

        $risk = Risk::create([
            'tenant_id' => $user->tenant_id,
            'submitted_by' => $user->id,
            'title' => 'No objective',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 2,
            'impact' => 2,
            'risk_owner_id' => $user->id,
        ]);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['strategic_objective_id']);
    }

    public function test_single_risk_owner_required_before_submit(): void
    {
        [$http, $user] = $this->asStaff();
        $objective = $this->makeObjective($user->tenant_id);

        $risk = Risk::create([
            'tenant_id' => $user->tenant_id,
            'submitted_by' => $user->id,
            'title' => 'No owner',
            'description' => 'Desc',
            'category' => 'operational',
            'likelihood' => 2,
            'impact' => 2,
            'strategic_objective_id' => $objective->id,
        ]);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['risk_owner_id']);
    }

    public function test_inherent_and_residual_assessments_are_preserved_separately(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->createReadyRisk($user);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/assessments", [
            'assessment_type' => 'residual',
            'likelihood' => 2,
            'impact' => 3,
            'rationale' => 'After controls',
        ])->assertCreated();

        $http->postJson("/api/v1/risk/risks/{$risk->id}/assessments", [
            'assessment_type' => 'residual',
            'likelihood' => 1,
            'impact' => 2,
            'rationale' => 'Further residual judgment',
        ])->assertCreated();

        $inherentCount = RiskAssessment::where('risk_id', $risk->id)->where('assessment_type', 'inherent')->count();
        $residualRows = RiskAssessment::where('risk_id', $risk->id)->where('assessment_type', 'residual')->orderBy('id')->get();

        $this->assertGreaterThanOrEqual(1, $inherentCount);
        $this->assertCount(2, $residualRows);
        $this->assertNotNull($residualRows[0]->superseded_at);
        $this->assertNull($residualRows[1]->superseded_at);
        $this->assertSame(6, $residualRows[0]->score);
        $this->assertSame(2, $residualRows[1]->score);
        $this->assertNotEquals(
            RiskAssessment::where('risk_id', $risk->id)->where('assessment_type', 'inherent')->whereNull('superseded_at')->value('score'),
            $residualRows[1]->score
        );
    }

    public function test_rejects_arbitrary_residual_control_reduction_formula(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->createReadyRisk($user);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/assessments", [
            'assessment_type' => 'residual',
            'likelihood' => 2,
            'impact' => 2,
            'control_reduction_pct' => 40,
        ])->assertUnprocessable();

        $http->putJson("/api/v1/risk/risks/{$risk->id}", [
            'controls_reduce_percent' => 25,
        ])->assertUnprocessable();
    }

    public function test_high_critical_acceptance_not_by_owner_alone(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $risk = $this->createReadyRisk($owner, ['likelihood' => 4, 'impact' => 4]);

        // Move to approved + residual high
        $risk->update(['status' => 'approved']);
        $this->asUser($owner)->postJson("/api/v1/risk/risks/{$risk->id}/assessments", [
            'assessment_type' => 'residual',
            'likelihood' => 4,
            'impact' => 4,
            'rationale' => 'Still high',
        ])->assertCreated();

        $acceptance = $this->asUser($owner)->postJson("/api/v1/risk/risks/{$risk->id}/acceptances", [
            'justification' => 'We accept this for now',
            'expires_at' => now()->addMonths(3)->toDateString(),
        ])->assertCreated()->json('data');

        $this->asUser($owner)->postJson("/api/v1/risk/acceptances/{$acceptance['id']}/decide", [
            'decision' => 'approved',
        ])->assertUnprocessable();

        $director = $this->makeUser('Director', $tenant);
        $this->asUser($director)->postJson("/api/v1/risk/acceptances/{$acceptance['id']}/decide", [
            'decision' => 'approved',
            'decision_notes' => 'Director approval',
        ])->assertOk()
            ->assertJsonPath('data.status', 'approved');
    }

    public function test_treatment_creates_assignment_idempotently(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->createReadyRisk($user);
        $risk->update(['status' => 'approved']);

        $res = $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description' => 'Implement backup control',
            'treatment_type' => 'mitigate',
            'owner_id' => $user->id,
            'due_date' => now()->addDays(10)->toDateString(),
        ])->assertCreated();

        $actionId = $res->json('data.id');
        $assignmentId = $res->json('data.assignment_id');
        $this->assertNotNull($assignmentId);

        $action = RiskAction::findOrFail($actionId);
        $again = app(\App\Modules\Risk\Services\RiskActionService::class)
            ->createAssignmentForAction($action, $user);

        $this->assertSame((int) $assignmentId, (int) $again->id);
        $this->assertSame(1, Assignment::where('source_type', 'risk')->where('source_id', $actionId)->where('source_purpose', 'treatment_action')->count());

        $beforeResidual = $risk->fresh()->residual_score;
        $http->postJson("/api/v1/risk/risks/{$risk->id}/actions/{$actionId}/complete", [])
            ->assertOk();

        $risk->refresh();
        $this->assertTrue($risk->residual_reassessment_required);
        $this->assertSame($beforeResidual, $risk->residual_score);
    }

    public function test_internal_auditor_cannot_be_risk_owner(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $auditor = $this->makeUser('Internal Auditor', $tenant);
        $objective = $this->makeObjective($tenant->id);

        $this->asUser($staff)->postJson('/api/v1/risk/risks', [
            'title' => 'IA owner blocked',
            'description' => 'Desc',
            'category' => 'compliance',
            'likelihood' => 2,
            'impact' => 3,
            'strategic_objective_id' => $objective->id,
            'risk_owner_id' => $auditor->id,
        ])->assertUnprocessable()
            ->assertJsonValidationErrors(['risk_owner_id']);
    }

    public function test_closed_risk_is_not_hard_deleted(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->createReadyRisk($user);
        $risk->update([
            'status' => 'closed',
            'closure_evidence' => 'Done',
            'closed_by' => $user->id,
            'closed_at' => now(),
        ]);

        $http->deleteJson("/api/v1/risk/risks/{$risk->id}")
            ->assertUnprocessable();

        $this->assertDatabaseHas('risks', ['id' => $risk->id, 'status' => 'closed']);
        $this->assertNull(Risk::withTrashed()->find($risk->id)?->deleted_at);
    }

    public function test_confidential_risks_hidden_from_list_and_search(): void
    {
        $tenant = Tenant::factory()->create();
        $owner = $this->makeUser('staff', $tenant);
        $other = $this->makeUser('staff', $tenant);

        $this->createReadyRisk($owner, [
            'title' => 'Secret Cyber Risk Alpha',
            'is_confidential' => true,
        ]);

        $visible = $this->asUser($other)->getJson('/api/v1/risk/risks?search=Secret%20Cyber')
            ->assertOk()
            ->json('data');

        $this->assertCount(0, $visible);

        $ownerSees = $this->asUser($owner)->getJson('/api/v1/risk/risks?search=Secret%20Cyber')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($ownerSees);
    }

    public function test_materialised_risk_stays_open_until_deliberate_close(): void
    {
        $tenant = Tenant::factory()->create();
        $user = $this->makeUser('Director', $tenant);
        $risk = $this->createReadyRisk($user);
        $risk->update(['status' => 'approved']);

        $this->asUser($user)->postJson("/api/v1/risk/risks/{$risk->id}/materialise", [
            'notes' => 'Event occurred',
            'create_incident' => true,
        ])->assertOk()
            ->assertJsonPath('data.status', 'monitoring');

        $risk->refresh();
        $this->assertNotNull($risk->materialised_at);
        $this->assertNotSame('closed', $risk->status);
        $this->assertDatabaseHas('risk_incidents', ['risk_id' => $risk->id]);

        $this->asUser($user)->postJson("/api/v1/risk/risks/{$risk->id}/close", [
            'closure_evidence' => 'Treated and closed deliberately',
        ])->assertOk()
            ->assertJsonPath('data.status', 'closed');
    }
}
