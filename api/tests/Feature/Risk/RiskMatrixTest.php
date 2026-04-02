<?php

namespace Tests\Feature\Risk;

use App\Models\Risk;
use App\Models\Tenant;
use Tests\TestCase;

class RiskMatrixTest extends TestCase
{
    public function test_unauthenticated_cannot_access_matrix(): void
    {
        $this->getJson('/api/v1/risk/matrix')->assertUnauthorized();
    }

    public function test_authenticated_user_can_access_matrix(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/risk/matrix')->assertOk();
    }

    public function test_matrix_returns_25_cells(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/risk/matrix');
        $response->assertOk();

        $cells = $response->json('cells');
        $this->assertIsArray($cells);
        $this->assertCount(25, $cells);
    }

    public function test_matrix_cell_count_reflects_actual_risks(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        // Create 2 risks at likelihood=2, impact=3 (score=6, medium)
        for ($i = 0; $i < 2; $i++) {
            Risk::create([
                'tenant_id'    => $tenant->id,
                'submitted_by' => $user->id,
                'title'        => "Risk {$i}",
                'description'  => 'Test',
                'category'     => 'operational',
                'likelihood'   => 2,
                'impact'       => 3,
                'status'       => 'submitted',
            ]);
        }

        $response = $http->getJson('/api/v1/risk/matrix');
        $response->assertOk();

        $cells = collect($response->json('cells'));
        $matchingCell = $cells->first(fn($c) => $c['likelihood'] === 2 && $c['impact'] === 3);

        $this->assertNotNull($matchingCell);
        $this->assertGreaterThanOrEqual(2, $matchingCell['count']);
    }

    public function test_matrix_by_status_summary(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        Risk::create([
            'tenant_id'    => $tenant->id,
            'submitted_by' => $user->id,
            'title'        => 'Draft risk',
            'description'  => 'Test',
            'category'     => 'operational',
            'likelihood'   => 2,
            'impact'       => 2,
            'status'       => 'draft',
        ]);

        $response = $http->getJson('/api/v1/risk/matrix');
        $response->assertOk();

        $byStatus = $response->json('by_status');
        $this->assertIsArray($byStatus);
        $this->assertArrayHasKey('draft', $byStatus);
    }

    public function test_matrix_excludes_other_tenant_risks(): void
    {
        $tenantA = Tenant::factory()->create();
        $tenantB = Tenant::factory()->create();

        $userA = $this->makeUser('staff', $tenantA);
        $userB = $this->makeUser('staff', $tenantB);

        // Create 3 risks for tenantA at a unique likelihood/impact combo (5,5)
        for ($i = 0; $i < 3; $i++) {
            Risk::create([
                'tenant_id'    => $tenantA->id,
                'submitted_by' => $userA->id,
                'title'        => "TenantA Risk {$i}",
                'description'  => 'Tenant A test',
                'category'     => 'strategic',
                'likelihood'   => 5,
                'impact'       => 5,
                'status'       => 'submitted',
            ]);
        }

        // TenantB user sees 0 risks (no risks in their tenant)
        $this->asUser($userB);
        $response = $this->getJson('/api/v1/risk/matrix');
        $response->assertOk();

        $cells = collect($response->json('cells'));
        $cell = $cells->first(fn($c) => $c['likelihood'] === 5 && $c['impact'] === 5);

        // tenantB should see 0 at this cell since none belong to them
        $this->assertSame(0, $cell['count']);
    }
}
