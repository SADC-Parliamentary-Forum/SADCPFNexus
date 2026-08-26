<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\MeReviewHistory;
use App\Models\Programme;
use App\Models\Tenant;
use Tests\TestCase;

class ReviewWorkflowTest extends TestCase
{
    private function makeReport(Tenant $tenant, int $userId, string $status = 'not_submitted'): MeActivityReport
    {
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $userId,
            'reference_number' => 'PIF-'.uniqid(), 'title' => 'P', 'status' => 'approved',
        ]);

        return MeActivityReport::create([
            'tenant_id' => $tenant->id, 'programme_id' => $programme->id,
            'activity_title' => 'Activity', 'review_status' => $status,
            'created_by' => $userId, 'responsible_officer_id' => $userId,
        ]);
    }

    public function test_owner_can_submit_report(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asMeOfficer($tenant);
        $report = $this->makeReport($tenant, $user->id);

        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.review_status', 'submitted');
    }

    public function test_governance_officer_can_review_submitted_report(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $report = $this->makeReport($tenant, $staff->id, 'submitted');

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/review", [
            'review_notes' => 'Looks good, indicators aligned.',
        ])->assertOk()
            ->assertJsonPath('data.review_status', 'reviewed');
    }

    public function test_reviewer_can_return_for_correction(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $report = $this->makeReport($tenant, $staff->id, 'submitted');

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/return", [
            'review_notes' => 'Please attach attendance register.',
        ])->assertOk()
            ->assertJsonPath('data.review_status', 'returned');
    }

    public function test_return_requires_notes(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $report = $this->makeReport($tenant, $staff->id, 'submitted');

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/return", [])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['review_notes']);
    }

    public function test_full_lifecycle_review_accept_close(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $report = $this->makeReport($tenant, $staff->id, 'submitted');

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/review")->assertOk();
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/accept")
            ->assertOk()->assertJsonPath('data.review_status', 'accepted');
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/close")
            ->assertOk()
            ->assertJsonPath('data.review_status', 'closed')
            ->assertJsonPath('data.closure_status', 'closed');
    }

    public function test_staff_cannot_review(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $report = $this->makeReport($tenant, $user->id, 'submitted');

        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/review")
            ->assertForbidden();
    }

    public function test_cannot_accept_before_review(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $report = $this->makeReport($tenant, $staff->id, 'submitted');

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/accept")
            ->assertStatus(422);
    }

    public function test_each_transition_records_history(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asMeOfficer($tenant);
        $report = $this->makeReport($tenant, $user->id);

        $before = MeReviewHistory::where('me_activity_report_id', $report->id)->count();
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/submit")->assertOk();
        $after = MeReviewHistory::where('me_activity_report_id', $report->id)->count();

        $this->assertGreaterThan($before, $after);

        $entry = MeReviewHistory::where('me_activity_report_id', $report->id)
            ->where('change_type', 'submitted')->first();
        $this->assertNotNull($entry);
        $this->assertSame(64, strlen($entry->hash));
    }
}
