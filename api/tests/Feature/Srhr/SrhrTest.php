<?php

namespace Tests\Feature\SRHR;

use App\Models\Parliament;
use App\Models\ResearcherReport;
use App\Models\StaffDeployment;
use App\Models\Tenant;
use Tests\TestCase;

class SrhrTest extends TestCase
{
    // ─── Parliaments ─────────────────────────────────────────────────────────

    public function test_unauthenticated_cannot_list_parliaments(): void
    {
        $this->getJson('/api/v1/srhr/parliaments')->assertUnauthorized();
    }

    public function test_admin_can_create_parliament(): void
    {
        [$http] = $this->asAdmin();

        $response = $http->postJson('/api/v1/srhr/parliaments', [
            'name'         => 'Parliament of Zimbabwe',
            'country_code' => 'ZW',
            'country_name' => 'Zimbabwe',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('parliaments', [
            'country_code' => 'ZW',
            'name'         => 'Parliament of Zimbabwe',
        ]);
    }

    public function test_parliament_requires_country(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/srhr/parliaments', [
            'name' => 'No country parliament',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['country_code']);
    }

    public function test_anyone_can_list_parliaments(): void
    {
        [$http] = $this->asAdmin();

        $http->getJson('/api/v1/srhr/parliaments')->assertOk();
    }

    // ─── Deployments ─────────────────────────────────────────────────────────

    public function test_admin_can_create_deployment(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $researcher = $this->makeUser('Field Researcher', $tenant);

        $parliament = Parliament::create([
            'tenant_id'    => $tenant->id,
            'country_code' => 'ZM',
            'country_name' => 'Zambia',
            'name'         => 'National Assembly of Zambia',
        ]);

        $http->postJson('/api/v1/srhr/deployments', [
            'employee_id'     => $researcher->id,
            'parliament_id'   => $parliament->id,
            'deployment_type' => 'field_researcher',
            'start_date'      => now()->toDateString(),
            'status'          => 'active',
        ])->assertCreated();

        $this->assertDatabaseHas('staff_deployments', [
            'employee_id'   => $researcher->id,
            'parliament_id' => $parliament->id,
        ]);
    }

    // ─── Researcher Reports ──────────────────────────────────────────────────

    public function test_staff_can_create_researcher_report(): void
    {
        $tenant     = Tenant::factory()->create();
        $researcher = $this->makeUser('Field Researcher', $tenant);
        [$http]     = $this->asAdmin($tenant);

        // Need a deployment first
        $parliament = Parliament::create([
            'tenant_id'    => $tenant->id,
            'country_code' => 'BW',
            'country_name' => 'Botswana',
            'name'         => 'Parliament of Botswana',
        ]);

        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcher->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-TEST-' . uniqid(),
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcher->id,
        ]);

        $http->postJson('/api/v1/srhr/reports', [
            'deployment_id' => $deployment->id,
            'report_type'   => 'monthly',
            'period_start'  => now()->startOfMonth()->toDateString(),
            'period_end'    => now()->endOfMonth()->toDateString(),
            'title'         => 'Q1 2026 Field Report',
        ])->assertCreated();
    }

    public function test_staff_can_list_own_reports(): void
    {
        [$http] = $this->asAdmin();

        $http->getJson('/api/v1/srhr/reports')->assertOk();
    }

    public function test_researcher_report_requires_title(): void
    {
        $tenant     = Tenant::factory()->create();
        $researcher = $this->makeUser('Field Researcher', $tenant);
        [$http]     = $this->asAdmin($tenant);

        $parliament = Parliament::create([
            'tenant_id'    => $tenant->id,
            'country_code' => 'ZW',
            'country_name' => 'Zimbabwe',
            'name'         => 'Parliament of Zimbabwe',
        ]);

        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcher->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-REQ-' . uniqid(),
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcher->id,
        ]);

        $http->postJson('/api/v1/srhr/reports', [
            'deployment_id' => $deployment->id,
            'report_type'   => 'monthly',
            'period_start'  => now()->startOfMonth()->toDateString(),
            'period_end'    => now()->endOfMonth()->toDateString(),
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_admin_can_delete_researcher_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $researcher = $this->makeUser('Field Researcher', $tenant);

        $parliament = Parliament::create([
            'tenant_id'    => $tenant->id,
            'country_code' => 'MW',
            'country_name' => 'Malawi',
            'name'         => 'Parliament of Malawi',
        ]);

        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcher->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-DEL-' . uniqid(),
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcher->id,
        ]);

        $report = ResearcherReport::create([
            'tenant_id'        => $tenant->id,
            'employee_id'      => $researcher->id,
            'deployment_id'    => $deployment->id,
            'parliament_id'    => $parliament->id,
            'reference_number' => 'RPT-' . uniqid(),
            'title'            => 'Test Report',
            'report_type'      => 'monthly',
            'period_start'     => now()->startOfMonth()->toDateString(),
            'period_end'       => now()->endOfMonth()->toDateString(),
            'status'           => 'draft',
        ]);

        $http->deleteJson("/api/v1/srhr/reports/{$report->id}")->assertOk();
        $this->assertSoftDeleted('researcher_reports', ['id' => $report->id]);
    }
}
