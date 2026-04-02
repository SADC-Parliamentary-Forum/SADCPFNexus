<?php

namespace Tests\Feature\Risk;

use App\Models\Risk;
use App\Models\RiskAction;
use App\Models\Tenant;
use Tests\TestCase;

class RiskActionTest extends TestCase
{
    private function makeDraftRisk(int $tenantId, int $userId): Risk
    {
        return Risk::create([
            'tenant_id'    => $tenantId,
            'submitted_by' => $userId,
            'title'        => 'Operational disruption risk',
            'description'  => 'Risk of key system downtime impacting operations',
            'category'     => 'operational',
            'likelihood'   => 3,
            'impact'       => 3,
        ]);
    }

    public function test_authenticated_user_can_add_action_to_risk(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description'    => 'Implement backup systems',
            'treatment_type' => 'mitigate',
            'due_date'       => now()->addDays(30)->toDateString(),
        ])->assertCreated()
          ->assertJsonPath('data.description', 'Implement backup systems');
    }

    public function test_action_requires_description(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['description']);
    }

    public function test_can_list_actions_for_risk(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description' => 'Action one',
        ]);
        $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description' => 'Action two',
        ]);

        $response = $http->getJson("/api/v1/risk/risks/{$risk->id}/actions");
        $response->assertOk();
        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_can_update_action(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $createResp = $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description' => 'Original action description',
        ]);
        $actionId = $createResp->json('data.id');

        $http->putJson("/api/v1/risk/risks/{$risk->id}/actions/{$actionId}", [
            'description' => 'Updated action description',
            'progress'    => 50,
        ])->assertOk()
          ->assertJsonPath('data.description', 'Updated action description')
          ->assertJsonPath('data.progress', 50);
    }

    public function test_can_mark_action_complete(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $createResp = $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description' => 'Action to complete',
        ]);
        $actionId = $createResp->json('data.id');

        $http->postJson("/api/v1/risk/risks/{$risk->id}/actions/{$actionId}/complete", [
            'notes' => 'Completed via quarterly review',
        ])->assertOk()
          ->assertJsonPath('data.status', 'completed')
          ->assertJsonPath('data.progress', 100);
    }

    public function test_cannot_delete_in_progress_action(): void
    {
        [$http, $user] = $this->asStaff();
        $risk = $this->makeDraftRisk($user->tenant_id, $user->id);

        $createResp = $http->postJson("/api/v1/risk/risks/{$risk->id}/actions", [
            'description' => 'Action to try to delete',
        ]);
        $actionId = $createResp->json('data.id');

        // Mark as in_progress
        $http->putJson("/api/v1/risk/risks/{$risk->id}/actions/{$actionId}", [
            'status' => 'in_progress',
        ]);

        $http->deleteJson("/api/v1/risk/risks/{$risk->id}/actions/{$actionId}")
             ->assertUnprocessable();
    }

    public function test_tenant_isolation_on_actions(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$httpA, $userA] = $this->asStaff($tenantA);
        $riskA = $this->makeDraftRisk($tenantA->id, $userA->id);
        $createResp = $httpA->postJson("/api/v1/risk/risks/{$riskA->id}/actions", [
            'description' => 'Tenant A action',
        ]);
        $actionId = $createResp->json('data.id');

        [$httpB] = $this->asStaff($tenantB);
        $httpB->getJson("/api/v1/risk/risks/{$riskA->id}/actions")
              ->assertNotFound();
    }
}
