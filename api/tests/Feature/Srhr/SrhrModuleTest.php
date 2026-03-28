<?php

namespace Tests\Feature\Srhr;

use App\Models\Parliament;
use App\Models\StaffDeployment;
use App\Models\Tenant;
use App\Models\User;
use Illuminate\Support\Str;
use Tests\TestCase;

class SrhrModuleTest extends TestCase
{
    // ── Parliaments ───────────────────────────────────────────────────────────

    public function test_admin_can_list_parliaments(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        Parliament::factory()->count(3)->create(['tenant_id' => $tenant->id]);

        $response = $http->getJson('/api/v1/srhr/parliaments');
        $response->assertOk();
        $this->assertGreaterThanOrEqual(3, count($response->json('data')));
    }

    public function test_admin_can_create_a_parliament(): void
    {
        [$http] = $this->asAdmin();

        $response = $http->postJson('/api/v1/srhr/parliaments', [
            'name'         => 'Parliament of Zimbabwe',
            'country_code' => 'ZW',
            'country_name' => 'Zimbabwe',
            'city'         => 'Harare',
            'is_active'    => true,
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.name', 'Parliament of Zimbabwe')
                 ->assertJsonPath('data.country_code', 'ZW');
    }

    public function test_creating_parliament_requires_name_and_country_code(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/srhr/parliaments', [])
             ->assertUnprocessable()
             ->assertJsonValidationErrors(['name', 'country_code', 'country_name']);
    }

    // ── Deployments ──────────────────────────────────────────────────────────

    public function test_admin_can_create_a_deployment(): void
    {
        $tenant     = Tenant::factory()->create();
        [$http]     = $this->asAdmin($tenant);
        $parliament = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $employee   = $this->makeUser('Field Researcher', $tenant);

        $response = $http->postJson('/api/v1/srhr/deployments', [
            'employee_id'     => $employee->id,
            'parliament_id'   => $parliament->id,
            'deployment_type' => 'field_researcher',
            'start_date'      => now()->toDateString(),
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'active');
    }

    public function test_duplicate_active_deployment_is_rejected(): void
    {
        $tenant     = Tenant::factory()->create();
        [$http]     = $this->asAdmin($tenant);
        $parliament = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $employee   = $this->makeUser('Field Researcher', $tenant);

        // First deployment
        $http->postJson('/api/v1/srhr/deployments', [
            'employee_id'     => $employee->id,
            'parliament_id'   => $parliament->id,
            'deployment_type' => 'field_researcher',
            'start_date'      => now()->toDateString(),
        ])->assertCreated();

        // Second deployment for the same employee (already active)
        $http->postJson('/api/v1/srhr/deployments', [
            'employee_id'     => $employee->id,
            'parliament_id'   => $parliament->id,
            'deployment_type' => 'field_researcher',
            'start_date'      => now()->toDateString(),
        ])->assertUnprocessable();
    }

    public function test_admin_can_recall_an_active_deployment(): void
    {
        $tenant     = Tenant::factory()->create();
        [$http]     = $this->asAdmin($tenant);
        $parliament = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $employee   = $this->makeUser('Field Researcher', $tenant);

        $create = $http->postJson('/api/v1/srhr/deployments', [
            'employee_id'     => $employee->id,
            'parliament_id'   => $parliament->id,
            'deployment_type' => 'field_researcher',
            'start_date'      => now()->toDateString(),
        ]);
        $create->assertCreated();
        $deploymentId = $create->json('data.id');

        $recall = $http->postJson("/api/v1/srhr/deployments/{$deploymentId}/recall", [
            'reason' => 'Position restructured — no longer required.',
        ]);

        $recall->assertOk()
               ->assertJsonPath('data.status', 'recalled');
    }

    // ── Researcher Reports ────────────────────────────────────────────────────

    public function test_field_researcher_can_create_a_draft_report(): void
    {
        $tenant     = Tenant::factory()->create();
        $parliament = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $researcher = $this->makeUser('Field Researcher', $tenant);

        // Create an active deployment for the researcher
        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcher->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-' . date('Y') . '-T01',
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcher->id,
        ]);

        $response = $this->asUser($researcher)->postJson('/api/v1/srhr/reports', [
            'deployment_id' => $deployment->id,
            'report_type'   => 'monthly',
            'period_start'  => now()->startOfMonth()->toDateString(),
            'period_end'    => now()->endOfMonth()->toDateString(),
            'title'         => 'March 2026 Monthly Activity Report',
        ]);

        $response->assertCreated()
                 ->assertJsonPath('data.status', 'draft')
                 ->assertJsonPath('data.report_type', 'monthly');
    }

    public function test_field_researcher_can_submit_their_draft_report(): void
    {
        $tenant     = Tenant::factory()->create();
        $parliament = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $researcher = $this->makeUser('Field Researcher', $tenant);

        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcher->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-' . date('Y') . '-T02',
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcher->id,
        ]);

        $http   = $this->asUser($researcher);
        $create = $http->postJson('/api/v1/srhr/reports', [
            'deployment_id' => $deployment->id,
            'report_type'   => 'monthly',
            'period_start'  => now()->startOfMonth()->toDateString(),
            'period_end'    => now()->endOfMonth()->toDateString(),
            'title'         => 'Test Monthly Report',
        ]);
        $create->assertCreated();
        $reportId = $create->json('data.id');

        $submit = $http->postJson("/api/v1/srhr/reports/{$reportId}/submit");
        $submit->assertOk()
               ->assertJsonPath('data.status', 'submitted');
    }

    public function test_field_researcher_cannot_see_another_researchers_reports(): void
    {
        $tenant      = Tenant::factory()->create();
        $parliament  = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $researcherA = $this->makeUser('Field Researcher', $tenant);
        $researcherB = $this->makeUser('Field Researcher', $tenant);

        // Create a deployment + report for researcher A
        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcherA->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-' . date('Y') . '-T03',
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcherA->id,
        ]);

        $this->asUser($researcherA)->postJson('/api/v1/srhr/reports', [
            'deployment_id' => $deployment->id,
            'report_type'   => 'monthly',
            'period_start'  => now()->startOfMonth()->toDateString(),
            'period_end'    => now()->endOfMonth()->toDateString(),
            'title'         => 'Researcher A Report',
        ])->assertCreated();

        // Researcher B lists reports — should see zero
        $response = $this->asUser($researcherB)->getJson('/api/v1/srhr/reports');
        $response->assertOk();
        $this->assertCount(0, $response->json('data'));
    }

    public function test_admin_can_acknowledge_a_submitted_report(): void
    {
        $tenant     = Tenant::factory()->create();
        $parliament = Parliament::factory()->create(['tenant_id' => $tenant->id]);
        $researcher = $this->makeUser('Field Researcher', $tenant);
        [$adminHttp] = $this->asAdmin($tenant);

        $deployment = StaffDeployment::create([
            'tenant_id'             => $tenant->id,
            'employee_id'           => $researcher->id,
            'parliament_id'         => $parliament->id,
            'reference_number'      => 'DPMT-' . date('Y') . '-T04',
            'deployment_type'       => 'field_researcher',
            'start_date'            => now()->toDateString(),
            'status'                => 'active',
            'hr_managed_externally' => true,
            'payroll_active'        => true,
            'created_by'            => $researcher->id,
        ]);

        // Create and submit
        $researcherHttp = $this->asUser($researcher);
        $create         = $researcherHttp->postJson('/api/v1/srhr/reports', [
            'deployment_id' => $deployment->id,
            'report_type'   => 'monthly',
            'period_start'  => now()->startOfMonth()->toDateString(),
            'period_end'    => now()->endOfMonth()->toDateString(),
            'title'         => 'Report for Acknowledgement',
        ]);
        $create->assertCreated();
        $reportId = $create->json('data.id');
        $researcherHttp->postJson("/api/v1/srhr/reports/{$reportId}/submit")->assertOk();

        // Admin acknowledges
        $adminHttp->postJson("/api/v1/srhr/reports/{$reportId}/acknowledge")
                  ->assertOk()
                  ->assertJsonPath('data.status', 'acknowledged');
    }
}
