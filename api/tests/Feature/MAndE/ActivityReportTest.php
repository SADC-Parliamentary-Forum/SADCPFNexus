<?php

namespace Tests\Feature\MAndE;

use App\Models\Indicator;
use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ActivityReportTest extends TestCase
{
    private function approvedProgramme(Tenant $tenant, int $userId): Programme
    {
        return Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $userId,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Approved Programme',
            'status'           => 'approved',
            'approved_at'      => now(),
        ]);
    }

    public function test_staff_can_create_report_against_approved_pif(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $http->postJson('/api/v1/mande/activity-reports', [
            'programme_id'   => $programme->id,
            'activity_title' => 'Regional SRHR Workshop',
            'actual_participants' => 45,
        ])->assertCreated()
          ->assertJsonPath('data.activity_title', 'Regional SRHR Workshop')
          ->assertJsonPath('data.review_status', 'not_submitted');

        $this->assertDatabaseHas('me_activity_reports', [
            'programme_id' => $programme->id,
            'tenant_id'    => $tenant->id,
        ]);
    }

    public function test_cannot_create_report_against_unapproved_pif(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $draft = Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Draft Programme',
            'status'           => 'draft',
        ]);

        $http->postJson('/api/v1/mande/activity-reports', [
            'programme_id'   => $draft->id,
            'activity_title' => 'Should fail',
        ])->assertStatus(422)
          ->assertJsonValidationErrors(['programme_id']);
    }

    public function test_report_links_indicators_with_planned_and_actual(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $indicator = Indicator::create([
            'tenant_id' => $tenant->id, 'name' => 'MPs trained', 'result_level' => 'output', 'created_by' => $user->id,
        ]);

        $http->postJson('/api/v1/mande/activity-reports', [
            'programme_id'   => $programme->id,
            'activity_title' => 'Workshop with indicators',
            'indicators'     => [
                ['indicator_id' => $indicator->id, 'planned_value' => 50, 'actual_value' => 48],
            ],
        ])->assertCreated();

        $this->assertDatabaseHas('me_activity_report_indicator', [
            'indicator_id'  => $indicator->id,
            'planned_value' => 50,
            'actual_value'  => 48,
        ]);
    }

    public function test_pif_linkages_endpoint_lists_approved_programmes(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $http->getJson('/api/v1/mande/pif-linkages')
             ->assertOk()
             ->assertJsonPath('data.0.id', $programme->id)
             ->assertJsonPath('data.0.has_report', false);
    }

    public function test_cannot_update_submitted_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $programme = $this->approvedProgramme($tenant, $user->id);

        $report = MeActivityReport::create([
            'tenant_id' => $tenant->id, 'programme_id' => $programme->id,
            'activity_title' => 'Locked', 'review_status' => 'submitted', 'created_by' => $user->id,
        ]);

        $http->putJson("/api/v1/mande/activity-reports/{$report->id}", ['activity_title' => 'X'])
             ->assertStatus(422);
    }
}
