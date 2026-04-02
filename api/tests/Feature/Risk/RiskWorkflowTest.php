<?php

namespace Tests\Feature\Risk;

use App\Models\Risk;
use App\Models\RiskHistory;
use App\Models\Tenant;
use Tests\TestCase;

class RiskWorkflowTest extends TestCase
{
    private function makeDraftRisk(int $tenantId, int $userId): Risk
    {
        return Risk::create([
            'tenant_id'    => $tenantId,
            'submitted_by' => $userId,
            'title'        => 'Strategic partnership risk',
            'description'  => 'Risk of key partner withdrawal from the programme',
            'category'     => 'strategic',
            'likelihood'   => 3,
            'impact'       => 4,
        ]);
    }

    // ── Submit ────────────────────────────────────────────────────────────────

    public function test_staff_can_submit_draft_risk(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/submit")
             ->assertOk()
             ->assertJsonPath('data.status', 'submitted');
    }

    public function test_cannot_submit_non_draft_risk(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);
        $risk->update(['status' => 'submitted']);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/submit")
             ->assertUnprocessable();
    }

    // ── Review ────────────────────────────────────────────────────────────────

    public function test_hod_can_start_review_on_submitted_risk(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'submitted']);

        $hod = $this->makeUser('HOD', $tenant);
        $this->asUser($hod)
             ->postJson("/api/v1/risk/risks/{$risk->id}/start-review")
             ->assertOk()
             ->assertJsonPath('data.status', 'reviewed');
    }

    public function test_director_can_start_review(): void
    {
        $tenant   = Tenant::factory()->create();
        $staff    = $this->makeUser('staff', $tenant);
        $risk     = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'submitted']);

        $director = $this->makeUser('Director', $tenant);
        $this->asUser($director)
             ->postJson("/api/v1/risk/risks/{$risk->id}/start-review")
             ->assertOk()
             ->assertJsonPath('data.status', 'reviewed');
    }

    public function test_staff_cannot_start_review(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $risk = $this->makeDraftRisk($tenant->id, $user->id);
        $risk->update(['status' => 'submitted']);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/start-review")
             ->assertForbidden();
    }

    // ── Approve ───────────────────────────────────────────────────────────────

    public function test_director_can_approve_reviewed_risk(): void
    {
        $tenant   = Tenant::factory()->create();
        $staff    = $this->makeUser('staff', $tenant);
        $risk     = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'reviewed']);

        $director = $this->makeUser('Director', $tenant);
        $this->asUser($director)
             ->postJson("/api/v1/risk/risks/{$risk->id}/approve")
             ->assertOk()
             ->assertJsonPath('data.status', 'approved');
    }

    public function test_sg_can_approve_reviewed_risk(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'reviewed']);

        [$http] = $this->asSG($tenant);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/approve")
             ->assertOk()
             ->assertJsonPath('data.status', 'approved');
    }

    public function test_staff_cannot_approve_risk(): void
    {
        $tenant = Tenant::factory()->create();
        $owner  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $owner->id);
        $risk->update(['status' => 'reviewed']);

        [$http] = $this->asStaff($tenant);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/approve")
             ->assertForbidden();
    }

    // ── Escalate ─────────────────────────────────────────────────────────────

    public function test_sg_can_escalate_risk(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'approved']);

        [$http] = $this->asSG($tenant);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/escalate", [
            'escalation_level' => 'sg',
            'notes'            => 'Critical risk requires SG attention',
        ])->assertOk()
          ->assertJsonPath('data.status', 'escalated')
          ->assertJsonPath('data.escalation_level', 'sg');
    }

    public function test_escalate_requires_escalation_level(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'approved']);

        [$http] = $this->asSG($tenant);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/escalate", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['escalation_level']);
    }

    // ── Close ─────────────────────────────────────────────────────────────────

    public function test_director_can_close_risk(): void
    {
        $tenant   = Tenant::factory()->create();
        $staff    = $this->makeUser('staff', $tenant);
        $risk     = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'approved']);

        $director = $this->makeUser('Director', $tenant);
        $this->asUser($director)
             ->postJson("/api/v1/risk/risks/{$risk->id}/close", [
                 'closure_evidence' => 'Risk has been fully mitigated through implementation of controls',
             ])->assertOk()
               ->assertJsonPath('data.status', 'closed');
    }

    public function test_closure_requires_evidence(): void
    {
        $tenant   = Tenant::factory()->create();
        $staff    = $this->makeUser('staff', $tenant);
        $risk     = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'approved']);

        $director = $this->makeUser('Director', $tenant);
        $this->asUser($director)
             ->postJson("/api/v1/risk/risks/{$risk->id}/close", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['closure_evidence']);
    }

    // ── Archive ───────────────────────────────────────────────────────────────

    public function test_sg_can_archive_closed_risk(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'closed']);

        [$http] = $this->asSG($tenant);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/archive")
             ->assertOk()
             ->assertJsonPath('data.status', 'archived');
    }

    // ── Reopen ────────────────────────────────────────────────────────────────

    public function test_governance_officer_can_reopen_closed_risk(): void
    {
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $risk   = $this->makeDraftRisk($tenant->id, $staff->id);
        $risk->update(['status' => 'closed']);

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/reopen")
             ->assertOk()
             ->assertJsonPath('data.status', 'submitted');
    }

    // ── History ───────────────────────────────────────────────────────────────

    public function test_each_transition_records_history_entry(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        // History from creation
        $before = RiskHistory::where('risk_id', $risk->id)->count();

        $http->postJson("/api/v1/risk/risks/{$risk->id}/submit");

        $after = RiskHistory::where('risk_id', $risk->id)->count();
        $this->assertGreaterThan($before, $after);
    }

    public function test_history_entry_has_hash(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/submit");

        $history = RiskHistory::where('risk_id', $risk->id)
                               ->where('change_type', 'submitted')
                               ->first();

        $this->assertNotNull($history);
        $this->assertNotNull($history->hash);
        $this->assertSame(64, strlen($history->hash));
    }
}
