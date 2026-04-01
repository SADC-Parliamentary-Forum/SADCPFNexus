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
            'country'       => 'Zimbabwe',
            'name'          => 'Parliament of Zimbabwe',
            'short_code'    => 'ZW',
            'parliament_type' => 'unicameral',
        ]);

        $response->assertCreated();
        $this->assertDatabaseHas('parliaments', [
            'country' => 'Zimbabwe',
            'name'    => 'Parliament of Zimbabwe',
        ]);
    }

    public function test_parliament_requires_country(): void
    {
        [$http] = $this->asAdmin();

        $http->postJson('/api/v1/srhr/parliaments', [
            'name' => 'No country parliament',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['country']);
    }

    public function test_anyone_can_list_parliaments(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/srhr/parliaments')->assertOk();
    }

    // ─── Deployments ─────────────────────────────────────────────────────────

    public function test_admin_can_create_deployment(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $admin] = $this->asAdmin($tenant);
        $researcher = $this->makeUser('staff', $tenant);

        $parliament = Parliament::create([
            'tenant_id'      => $tenant->id,
            'country'        => 'Zambia',
            'name'           => 'National Assembly of Zambia',
            'short_code'     => 'ZM',
            'parliament_type'=> 'unicameral',
        ]);

        $http->postJson('/api/v1/srhr/deployments', [
            'researcher_id' => $researcher->id,
            'parliament_id' => $parliament->id,
            'start_date'    => now()->toDateString(),
            'mandate'       => 'Monitor SRHR legislation progress.',
        ])->assertCreated();

        $this->assertDatabaseHas('staff_deployments', [
            'researcher_id' => $researcher->id,
            'parliament_id' => $parliament->id,
        ]);
    }

    // ─── Researcher Reports ──────────────────────────────────────────────────

    public function test_staff_can_create_researcher_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $parliament = Parliament::create([
            'tenant_id'      => $tenant->id,
            'country'        => 'Botswana',
            'name'           => 'Parliament of Botswana',
            'short_code'     => 'BW',
            'parliament_type'=> 'unicameral',
        ]);

        $http->postJson('/api/v1/srhr/reports', [
            'parliament_id'   => $parliament->id,
            'title'           => 'Q1 2026 Field Report',
            'period_month'    => 1,
            'period_year'     => 2026,
            'content'         => 'Summary of activities in Q1.',
        ])->assertCreated();
    }

    public function test_staff_can_list_own_reports(): void
    {
        [$http] = $this->asStaff();

        $http->getJson('/api/v1/srhr/reports')->assertOk();
    }

    public function test_researcher_report_requires_title(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/srhr/reports', [
            'period_month' => 1,
            'period_year'  => 2026,
            'content'      => 'Some content',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['title']);
    }

    public function test_admin_can_delete_researcher_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);
        $researcher = $this->makeUser('staff', $tenant);

        $parliament = Parliament::create([
            'tenant_id'      => $tenant->id,
            'country'        => 'Malawi',
            'name'           => 'Parliament of Malawi',
            'short_code'     => 'MW',
            'parliament_type'=> 'unicameral',
        ]);

        $report = ResearcherReport::create([
            'tenant_id'    => $tenant->id,
            'researcher_id'=> $researcher->id,
            'parliament_id'=> $parliament->id,
            'reference_number' => 'RPT-' . uniqid(),
            'title'        => 'Test Report',
            'period_month' => 3,
            'period_year'  => 2026,
            'content'      => 'Content.',
            'status'       => 'draft',
        ]);

        $http->deleteJson("/api/v1/srhr/reports/{$report->id}")->assertOk();
        $this->assertDatabaseMissing('researcher_reports', ['id' => $report->id]);
    }
}
