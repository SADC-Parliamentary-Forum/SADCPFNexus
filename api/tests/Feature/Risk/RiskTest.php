<?php

namespace Tests\Feature\Risk;

use App\Models\Risk;
use App\Models\Tenant;
use Tests\TestCase;

class RiskTest extends TestCase
{
    private function riskPayload(array $overrides = []): array
    {
        return array_merge([
            'title'       => 'Financial data breach risk',
            'description' => 'Risk of unauthorized access to financial systems and data',
            'category'    => 'security',
            'likelihood'  => 3,
            'impact'      => 4,
        ], $overrides);
    }

    // ── Auth ─────────────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_risks(): void
    {
        $this->getJson('/api/v1/risk/risks')->assertUnauthorized();
    }

    // ── CRUD ─────────────────────────────────────────────────────────────────

    public function test_staff_can_create_risk(): void
    {
        [$http, $user] = $this->asStaff();

        $response = $http->postJson('/api/v1/risk/risks', $this->riskPayload());

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.title', 'Financial data breach risk');

        $this->assertDatabaseHas('risks', [
            'submitted_by' => $user->id,
            'status'       => 'draft',
        ]);
    }

    public function test_create_risk_requires_title_description_category_likelihood_impact(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/risk/risks', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['title', 'description', 'category', 'likelihood', 'impact']);
    }

    public function test_risk_score_is_automatically_computed_from_likelihood_and_impact(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/risk/risks', $this->riskPayload([
            'likelihood' => 4,
            'impact'     => 5,
        ]));

        $response->assertCreated()
                 ->assertJsonPath('data.inherent_score', 20);
    }

    public function test_risk_level_is_derived_from_score(): void
    {
        [$http] = $this->asStaff();

        // score 1-5 = low
        $r = $http->postJson('/api/v1/risk/risks', $this->riskPayload(['likelihood' => 1, 'impact' => 2]));
        $r->assertCreated()->assertJsonPath('data.risk_level', 'low');

        // score 6-10 = medium
        $r = $http->postJson('/api/v1/risk/risks', $this->riskPayload(['likelihood' => 2, 'impact' => 3]));
        $r->assertCreated()->assertJsonPath('data.risk_level', 'medium');

        // score 11-15 = high
        $r = $http->postJson('/api/v1/risk/risks', $this->riskPayload(['likelihood' => 3, 'impact' => 4]));
        $r->assertCreated()->assertJsonPath('data.risk_level', 'high');

        // score 16-25 = critical
        $r = $http->postJson('/api/v1/risk/risks', $this->riskPayload(['likelihood' => 4, 'impact' => 5]));
        $r->assertCreated()->assertJsonPath('data.risk_level', 'critical');
    }

    public function test_staff_can_list_own_risks(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $myUser] = $this->asStaff($tenant);
        $otherUser = $this->makeUser('staff', $tenant);

        // Create a risk for another user directly
        Risk::create([
            'tenant_id'    => $tenant->id,
            'submitted_by' => $otherUser->id,
            'title'        => 'Other user risk',
            'description'  => 'Desc',
            'category'     => 'operational',
            'likelihood'   => 2,
            'impact'       => 2,
        ]);

        $http->postJson('/api/v1/risk/risks', $this->riskPayload());

        $response = $http->getJson('/api/v1/risk/risks');
        $response->assertOk();

        $submitterIds = collect($response->json('data'))->pluck('submitted_by')->unique()->values()->toArray();
        $this->assertNotContains($otherUser->id, $submitterIds);
    }

    public function test_governance_officer_sees_all_tenant_risks(): void
    {
        $tenant  = Tenant::factory()->create();
        $staffA  = $this->makeUser('staff', $tenant);
        $staffB  = $this->makeUser('staff', $tenant);

        foreach ([$staffA, $staffB] as $s) {
            Risk::create([
                'tenant_id'    => $tenant->id,
                'submitted_by' => $s->id,
                'title'        => "Risk by {$s->id}",
                'description'  => 'Test description',
                'category'     => 'operational',
                'likelihood'   => 2,
                'impact'       => 3,
                'status'       => 'submitted',
            ]);
        }

        [$http] = $this->asGovernanceOfficer($tenant);
        $response = $http->getJson('/api/v1/risk/risks');
        $response->assertOk();

        $this->assertGreaterThanOrEqual(2, count($response->json('data')));
    }

    public function test_staff_can_update_draft_risk(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/risk/risks', $this->riskPayload());
        $id = $create->json('data.id');

        $http->putJson("/api/v1/risk/risks/{$id}", $this->riskPayload([
            'title' => 'Updated Risk Title',
        ]))->assertOk()
           ->assertJsonPath('data.title', 'Updated Risk Title');
    }

    public function test_staff_cannot_update_submitted_risk(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $create = $http->postJson('/api/v1/risk/risks', $this->riskPayload());
        $id = $create->json('data.id');

        // Submit it
        $http->postJson("/api/v1/risk/risks/{$id}/submit");

        // Try to update
        $http->putJson("/api/v1/risk/risks/{$id}", $this->riskPayload([
            'title' => 'Should not update',
        ]))->assertUnprocessable();
    }

    public function test_staff_can_delete_draft_risk(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/risk/risks', $this->riskPayload());
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/risk/risks/{$id}")->assertOk();

        $this->assertDatabaseMissing('risks', ['id' => $id, 'deleted_at' => null]);
    }

    public function test_cannot_delete_non_draft_risk(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/risk/risks', $this->riskPayload());
        $id = $create->json('data.id');

        $http->postJson("/api/v1/risk/risks/{$id}/submit");

        $http->deleteJson("/api/v1/risk/risks/{$id}")->assertUnprocessable();
    }

    public function test_tenant_isolation_on_risks(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$httpA] = $this->asStaff($tenantA);
        $createA = $httpA->postJson('/api/v1/risk/risks', $this->riskPayload());
        $idA = $createA->json('data.id');

        [$httpB] = $this->asStaff($tenantB);
        $httpB->getJson("/api/v1/risk/risks/{$idA}")->assertNotFound();
    }

    public function test_risk_code_is_auto_generated(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/risk/risks', $this->riskPayload());
        $response->assertCreated();

        $riskCode = $response->json('data.risk_code');
        $this->assertNotNull($riskCode);
        $this->assertStringStartsWith('RSK-', $riskCode);
        $this->assertSame(12, strlen($riskCode)); // RSK- (4) + 8 chars
    }
}
