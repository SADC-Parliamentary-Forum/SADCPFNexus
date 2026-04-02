<?php

namespace Tests\Feature\Governance;

use App\Models\Tenant;
use Tests\TestCase;

class GovernanceTest extends TestCase
{
    // ─── Committees ──────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_committees(): void
    {
        $this->getJson('/api/v1/governance/committees')->assertUnauthorized();
    }

    public function test_authenticated_user_can_list_committees(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/governance/committees');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    public function test_governance_officer_can_create_committee(): void
    {
        [$http] = $this->asGovernanceOfficer();

        $response = $http->postJson('/api/v1/governance/committees', [
            'name'      => 'Finance & Audit Committee',
            'is_active' => true,
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.name', 'Finance & Audit Committee');

        $this->assertDatabaseHas('governance_committees', ['name' => 'Finance & Audit Committee']);
    }

    public function test_create_committee_requires_name(): void
    {
        [$http] = $this->asGovernanceOfficer();

        $http->postJson('/api/v1/governance/committees', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name']);
    }

    public function test_governance_officer_can_update_committee(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $create = $http->postJson('/api/v1/governance/committees', [
            'name'      => 'Initial Name',
            'is_active' => true,
        ]);
        $id = $create->json('data.id');

        $http->putJson("/api/v1/governance/committees/{$id}", [
            'name'      => 'Updated Committee Name',
            'is_active' => true,
        ])->assertOk()
          ->assertJsonPath('data.name', 'Updated Committee Name');
    }

    public function test_governance_officer_can_delete_committee(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $create = $http->postJson('/api/v1/governance/committees', [
            'name'      => 'To Delete',
            'is_active' => true,
        ]);
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/governance/committees/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('governance_committees', ['id' => $id]);
    }

    // ─── Resolutions ──────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_resolutions(): void
    {
        $this->getJson('/api/v1/governance/resolutions')->assertUnauthorized();
    }

    public function test_authenticated_user_can_list_resolutions(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/governance/resolutions');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    public function test_governance_officer_can_create_resolution(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $response = $http->postJson('/api/v1/governance/resolutions', [
            'reference_number' => 'RES-2026-001',
            'title'            => 'Resolution on Annual Budget Approval',
            'status'           => 'Adopted',
            'description'      => 'The Executive Committee hereby resolves to approve the annual budget.',
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.reference_number', 'RES-2026-001');

        $this->assertDatabaseHas('governance_resolutions', ['reference_number' => 'RES-2026-001']);
    }

    public function test_create_resolution_requires_reference_number_and_title(): void
    {
        [$http] = $this->asGovernanceOfficer();

        $http->postJson('/api/v1/governance/resolutions', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['reference_number', 'title']);
    }

    public function test_governance_officer_can_update_resolution(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $create = $http->postJson('/api/v1/governance/resolutions', [
            'reference_number' => 'RES-2026-002',
            'title'            => 'Initial Title',
            'status'           => 'Draft',
            'description'      => 'Body text.',
        ]);
        $id = $create->json('data.id');

        $http->putJson("/api/v1/governance/resolutions/{$id}", [
            'title'  => 'Updated Resolution Title',
            'status' => 'Adopted',
        ])->assertOk()
          ->assertJsonPath('data.title', 'Updated Resolution Title');
    }

    public function test_governance_officer_can_delete_resolution(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $create = $http->postJson('/api/v1/governance/resolutions', [
            'reference_number' => 'RES-DEL-001',
            'title'            => 'To Delete',
            'status'           => 'Draft',
            'description'      => 'Will be deleted.',
        ]);
        $id = $create->json('data.id');

        $http->deleteJson("/api/v1/governance/resolutions/{$id}")
             ->assertOk();

        $this->assertDatabaseMissing('governance_resolutions', ['id' => $id]);
    }

    public function test_resolutions_are_tenant_scoped(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        [$httpA] = $this->asGovernanceOfficer($tenantA);
        $resA = $httpA->postJson('/api/v1/governance/resolutions', [
            'reference_number' => 'RES-A-001',
            'title'            => 'Tenant A Resolution',
            'status'           => 'Adopted',
            'description'      => 'Tenant A only.',
        ]);
        $idA = $resA->json('data.id');

        [$httpB] = $this->asGovernanceOfficer($tenantB);

        // Tenant B should not see Tenant A's resolution
        $httpB->getJson("/api/v1/governance/resolutions/{$idA}")
              ->assertNotFound();
    }

    // ─── Governance Meeting Types ─────────────────────────────────────────────

    public function test_can_list_governance_meeting_types(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/governance/meeting-types');
        $response->assertOk()
                 ->assertJsonStructure(['data']);
    }

    // ─── helper ──────────────────────────────────────────────────────────────

    protected function asGovernanceOfficer(?Tenant $tenant = null): array
    {
        $user = $this->makeGovernanceOfficer($tenant);
        return [$this->asUser($user), $user];
    }
}
