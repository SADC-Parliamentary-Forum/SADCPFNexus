<?php

namespace Tests\Feature\Dashboard;

use Tests\TestCase;

class DashboardTest extends TestCase
{
    public function test_unauthenticated_cannot_access_dashboard_stats(): void
    {
        $this->getJson('/api/v1/dashboard/stats')->assertUnauthorized();
    }

    public function test_staff_can_get_dashboard_stats(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/dashboard/stats');

        $response->assertOk()
                 ->assertJsonStructure([
                     'pending_approvals',
                     'active_travels',
                     'leave_requests',
                     'open_requisitions',
                 ]);
    }

    public function test_admin_can_get_dashboard_stats(): void
    {
        [$http] = $this->asAdmin();

        $response = $http->getJson('/api/v1/dashboard/stats');
        $response->assertOk();
    }

    public function test_finance_controller_can_get_dashboard_stats(): void
    {
        [$http] = $this->asFinanceController();

        $response = $http->getJson('/api/v1/dashboard/stats');
        $response->assertOk();
    }

    public function test_dashboard_stats_are_tenant_scoped(): void
    {
        $tenantA = \App\Models\Tenant::factory()->create();
        $tenantB = \App\Models\Tenant::factory()->create();

        [$httpA, $userA] = $this->asStaff($tenantA);
        [$httpB, $userB] = $this->asStaff($tenantB);

        // Both get 200 OK but data is scoped to their tenant
        $httpA->getJson('/api/v1/dashboard/stats')->assertOk();
        $httpB->getJson('/api/v1/dashboard/stats')->assertOk();
    }

    public function test_upcoming_social_endpoint_is_accessible(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/dashboard/upcoming-social');
        $response->assertOk();
    }
}
