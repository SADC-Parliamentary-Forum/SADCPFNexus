<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\MeSetting;
use App\Models\Programme;
use App\Models\Tenant;
use App\Models\User;
use Tests\TestCase;

class MePhase2PolishScoringPmReviewTest extends TestCase
{
    public function test_data_quality_includes_score_grade_and_breakdown(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asMeOfficer($tenant);

        Programme::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'reference_number' => 'PIF-'.uniqid(),
            'title' => 'Score fixture PIF',
            'status' => 'approved',
            'approved_at' => now(),
        ]);

        $res = $http->getJson('/api/v1/mande/data-quality')->assertOk()->json('data');

        $this->assertArrayHasKey('score', $res);
        $this->assertArrayHasKey('grade', $res);
        $this->assertArrayHasKey('score_breakdown', $res);
        $this->assertIsNumeric($res['score']);
        $this->assertGreaterThanOrEqual(0, $res['score']);
        $this->assertLessThanOrEqual(100, $res['score']);
        $this->assertNotEmpty($res['grade']);
        $this->assertNotEmpty($res['issues'][0]['remediation'] ?? null);
    }

    public function test_perfect_scan_scores_100(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asMeOfficer($tenant);

        $res = $http->getJson('/api/v1/mande/data-quality')->assertOk()->json('data');

        $this->assertSame(0, $res['summary']['total']);
        $this->assertSame(100, $res['score']);
        $this->assertSame('Excellent', $res['grade']);
    }

    public function test_pm_review_setting_on_blocks_accept_until_cleared(): void
    {
        $tenant = Tenant::factory()->create();
        MeSetting::create([
            'tenant_id' => $tenant->id,
            'auto_intake' => true,
            'report_due_days' => 14,
            'programme_manager_review' => true,
        ]);

        [$staffHttp, $staff] = $this->asMeOfficer($tenant);
        $reviewer = $this->makeUser('Governance Officer', $tenant);
        $pm = User::factory()->create(['tenant_id' => $tenant->id]);
        $pm->assignRole('Director');

        $report = MeActivityReport::create([
            'tenant_id' => $tenant->id,
            'programme_id' => null,
            'non_pif_reason' => 'PM review gate test activity',
            'activity_title' => 'PM gate report',
            'review_status' => 'not_submitted',
            'created_by' => $staff->id,
            'responsible_officer_id' => $staff->id,
            'intake_confirmed_at' => now(),
        ]);

        $staffHttp->postJson("/api/v1/mande/activity-reports/{$report->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.programme_review_status', 'pending');

        $this->asUser($reviewer)
            ->postJson("/api/v1/mande/activity-reports/{$report->id}/review", ['review_notes' => 'OK'])
            ->assertOk();

        $this->asUser($reviewer)
            ->postJson("/api/v1/mande/activity-reports/{$report->id}/accept", [])
            ->assertStatus(422);

        $this->asUser($pm)
            ->postJson("/api/v1/mande/activity-reports/{$report->id}/programme-review/clear", [
                'notes' => 'PM cleared',
            ])
            ->assertOk()
            ->assertJsonPath('data.programme_review_status', 'cleared');

        $this->asUser($reviewer)
            ->postJson("/api/v1/mande/activity-reports/{$report->id}/accept", [])
            ->assertOk()
            ->assertJsonPath('data.review_status', 'accepted');
    }

    public function test_pm_clear_sod_blocks_submitter(): void
    {
        $tenant = Tenant::factory()->create();
        MeSetting::create([
            'tenant_id' => $tenant->id,
            'auto_intake' => true,
            'report_due_days' => 14,
            'programme_manager_review' => true,
        ]);

        // Governance Officer can submit (as officer) and has mande.review — SoD must still block self-clear.
        [$http, $officer] = $this->asGovernanceOfficer($tenant);

        $report = MeActivityReport::create([
            'tenant_id' => $tenant->id,
            'non_pif_reason' => 'SoD PM clear test reason',
            'activity_title' => 'SoD PM',
            'review_status' => 'not_submitted',
            'created_by' => $officer->id,
            'responsible_officer_id' => $officer->id,
            'intake_confirmed_at' => now(),
        ]);

        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/submit")->assertOk();

        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/programme-review/clear", [
            'notes' => 'self clear',
        ])->assertStatus(422);
    }

    public function test_pm_review_setting_off_skips_gate(): void
    {
        $tenant = Tenant::factory()->create();
        MeSetting::create([
            'tenant_id' => $tenant->id,
            'auto_intake' => true,
            'report_due_days' => 14,
            'programme_manager_review' => false,
        ]);

        [$staffHttp, $staff] = $this->asMeOfficer($tenant);
        $reviewer = $this->makeUser('Governance Officer', $tenant);

        $report = MeActivityReport::create([
            'tenant_id' => $tenant->id,
            'non_pif_reason' => 'No PM gate needed here',
            'activity_title' => 'No PM gate',
            'review_status' => 'not_submitted',
            'created_by' => $staff->id,
            'responsible_officer_id' => $staff->id,
            'intake_confirmed_at' => now(),
        ]);

        $staffHttp->postJson("/api/v1/mande/activity-reports/{$report->id}/submit")
            ->assertOk()
            ->assertJsonPath('data.programme_review_status', null);

        $this->asUser($reviewer)
            ->postJson("/api/v1/mande/activity-reports/{$report->id}/review", [])
            ->assertOk();

        $this->asUser($reviewer)
            ->postJson("/api/v1/mande/activity-reports/{$report->id}/accept", [])
            ->assertOk();
    }

    public function test_pm_review_queue_lists_pending(): void
    {
        $tenant = Tenant::factory()->create();
        MeSetting::create([
            'tenant_id' => $tenant->id,
            'auto_intake' => true,
            'report_due_days' => 14,
            'programme_manager_review' => true,
        ]);

        [$staffHttp, $staff] = $this->asMeOfficer($tenant);
        $pm = $this->makeUser('Director', $tenant);

        $report = MeActivityReport::create([
            'tenant_id' => $tenant->id,
            'non_pif_reason' => 'Queue listing fixture',
            'activity_title' => 'Queue pending',
            'review_status' => 'not_submitted',
            'created_by' => $staff->id,
            'responsible_officer_id' => $staff->id,
            'intake_confirmed_at' => now(),
        ]);

        $staffHttp->postJson("/api/v1/mande/activity-reports/{$report->id}/submit")->assertOk();

        $this->asUser($pm)
            ->getJson('/api/v1/mande/programme-review-queue')
            ->assertOk()
            ->assertJsonFragment(['id' => $report->id]);
    }
}
