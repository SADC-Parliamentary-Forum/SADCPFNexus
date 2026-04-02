<?php

namespace Tests\Feature\Governance;

use App\Models\GovernanceResolution;
use App\Models\Tenant;
use Tests\TestCase;

class GovernanceExtendedTest extends TestCase
{
    // ─── Committees & Meeting Types ──────────────────────────────────────────

    public function test_unauthenticated_cannot_list_resolutions(): void
    {
        $this->getJson('/api/v1/governance/resolutions')->assertUnauthorized();
    }

    public function test_governance_officer_can_create_resolution(): void
    {
        [$http] = $this->asGovernanceOfficer();

        $response = $http->postJson('/api/v1/governance/resolutions', [
            'title'            => 'Resolution on Budget Approval',
            'reference_number' => 'RES-2026-001',
            'adopted_at'       => now()->toDateString(),
            'status'           => 'Adopted',
            'description'      => 'This resolution approves the 2026 budget.',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('governance_resolutions', [
            'title' => 'Resolution on Budget Approval',
        ]);
    }

    public function test_resolution_requires_title(): void
    {
        [$http] = $this->asGovernanceOfficer();

        $http->postJson('/api/v1/governance/resolutions', [
            'status' => 'adopted',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_staff_can_list_resolutions(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/governance/resolutions')->assertOk();
    }

    public function test_governance_officer_can_update_resolution(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $resolution = GovernanceResolution::create([
            'tenant_id'        => $tenant->id,
            'title'            => 'Original Title',
            'reference_number' => 'RES-2026-002',
            'adopted_at'       => now()->toDateString(),
            'status'           => 'Draft',
            'description'      => 'Draft resolution.',
        ]);

        $http->putJson("/api/v1/governance/resolutions/{$resolution->id}", [
            'title'  => 'Updated Title',
            'status' => 'Adopted',
        ])->assertOk();

        $this->assertDatabaseHas('governance_resolutions', [
            'id'     => $resolution->id,
            'title'  => 'Updated Title',
            'status' => 'Adopted',
        ]);
    }

    public function test_governance_officer_can_delete_resolution(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asGovernanceOfficer($tenant);

        $resolution = GovernanceResolution::create([
            'tenant_id'        => $tenant->id,
            'title'            => 'To Delete',
            'reference_number' => 'RES-2026-003',
            'adopted_at'       => now()->toDateString(),
            'status'           => 'Draft',
        ]);

        $http->deleteJson("/api/v1/governance/resolutions/{$resolution->id}")->assertOk();
        $this->assertDatabaseMissing('governance_resolutions', ['id' => $resolution->id]);
    }

    public function test_admin_can_create_committee(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/governance/committees', [
            'name' => 'Finance Sub-Committee',
            'type' => 'standing',
        ])->assertCreated();
    }

    public function test_admin_can_create_governance_meeting_type(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/governance/meeting-types', [
            'name' => 'Executive Committee',
        ])->assertCreated();
    }

    protected function asGovernanceOfficer(?Tenant $tenant = null): array
    {
        $user = $this->makeGovernanceOfficer($tenant);
        return [$this->asUser($user), $user];
    }
}
