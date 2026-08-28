<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\MeEvidence;
use App\Models\Programme;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class EvidenceTest extends TestCase
{
    private function makeReport(Tenant $tenant, int $userId): MeActivityReport
    {
        $programme = Programme::create([
            'tenant_id' => $tenant->id, 'created_by' => $userId,
            'reference_number' => 'PIF-' . uniqid(), 'title' => 'P', 'status' => 'approved',
        ]);

        return MeActivityReport::create([
            'tenant_id' => $tenant->id, 'programme_id' => $programme->id,
            'activity_title' => 'Activity', 'review_status' => 'submitted',
            'created_by' => $userId, 'responsible_officer_id' => $userId,
        ]);
    }

    public function test_staff_can_upload_evidence(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $report = $this->makeReport($tenant, $user->id);

        $file = $this->fakePdf('attendance.pdf');

        $http->post("/api/v1/mande/activity-reports/{$report->id}/evidence", [
            'file'          => $file,
            'evidence_type' => 'attendance',
            'title'         => 'Attendance register',
        ])->assertCreated()
          ->assertJsonPath('data.evidence_type', 'attendance')
          ->assertJsonPath('data.review_status', 'pending');

        $this->assertDatabaseHas('me_evidence', [
            'me_activity_report_id' => $report->id,
            'evidence_type'         => 'attendance',
        ]);
        $this->assertDatabaseHas('attachments', [
            'attachable_type' => MeEvidence::class,
            'document_type'   => 'me_evidence',
        ]);
    }

    public function test_evidence_upload_requires_file(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $report = $this->makeReport($tenant, $user->id);

        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/evidence", [
            'evidence_type' => 'photo',
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['file']);
    }

    public function test_reviewer_can_validate_evidence(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        $staff  = $this->makeUser('staff', $tenant);
        $report = $this->makeReport($tenant, $staff->id);

        $evidence = MeEvidence::create([
            'tenant_id' => $tenant->id, 'me_activity_report_id' => $report->id,
            'evidence_type' => 'report', 'review_status' => 'pending', 'uploaded_by' => $staff->id,
        ]);

        [$http] = $this->asGovernanceOfficer($tenant);
        $http->postJson("/api/v1/mande/activity-reports/{$report->id}/evidence/{$evidence->id}/review", [
            'review_status' => 'validated',
        ])->assertOk()
          ->assertJsonPath('data.review_status', 'validated');
    }

    public function test_evidence_listing_returns_uploaded_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $report = $this->makeReport($tenant, $user->id);

        MeEvidence::create([
            'tenant_id' => $tenant->id, 'me_activity_report_id' => $report->id,
            'evidence_type' => 'photo', 'review_status' => 'pending', 'uploaded_by' => $user->id,
        ]);

        $http->getJson("/api/v1/mande/activity-reports/{$report->id}/evidence")
             ->assertOk()
             ->assertJsonCount(1, 'data');
    }
}
