<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\Programme;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class MePhase2DataQualityDonorImportTest extends TestCase
{
    public function test_data_quality_scan_returns_summary(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/mande/data-quality')
            ->assertOk()
            ->assertJsonStructure([
                'data' => [
                    'summary' => ['total', 'error', 'warning', 'by_code'],
                    'issues',
                ],
            ]);
    }

    public function test_data_quality_flags_past_end_without_submission(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'programme_id'   => null,
            'non_pif_reason' => 'Past end date test case',
            'activity_title' => 'Overdue draft',
            'review_status'  => 'not_submitted',
            'start_date'     => now()->subDays(20)->toDateString(),
            'end_date'       => now()->subDays(5)->toDateString(),
            'report_due_at'  => now()->subDays(2),
            'created_by'     => $user->id,
            'responsible_officer_id' => $user->id,
        ]);

        $res = $http->getJson('/api/v1/mande/data-quality')->assertOk()->json('data');
        $codes = collect($res['issues'])->pluck('code')->all();
        $this->assertContains('past_end_without_submission', $codes);
    }

    public function test_donor_report_endpoint(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $http->getJson('/api/v1/mande/reports/donor')
            ->assertOk()
            ->assertJsonStructure([
                'data' => ['framework', 'activities', 'indicators'],
            ]);
    }

    public function test_csv_import_preview_and_commit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $csv = "activity_title,start_date,end_date,pif_number,non_pif_reason\n"
            . "Historical workshop,2025-01-01,2025-01-03,,Imported historical non-PIF activity\n";

        $file = UploadedFile::fake()->createWithContent('import.csv', $csv);

        $http->post('/api/v1/mande/import/preview', ['file' => $file], [
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.valid', 1);

        $file2 = UploadedFile::fake()->createWithContent('import.csv', $csv);

        $http->post('/api/v1/mande/import/commit', ['file' => $file2], [
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.created', 1);

        $this->assertDatabaseHas('me_activity_reports', [
            'tenant_id'      => $tenant->id,
            'activity_title' => 'Historical workshop',
            'programme_id'   => null,
        ]);
    }

    public function test_data_quality_flags_approved_pif_without_me(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        Programme::create([
            'tenant_id'        => $tenant->id,
            'created_by'       => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title'            => 'Unlinked approved PIF',
            'status'           => 'approved',
            'approved_at'      => now(),
        ]);

        $res = $http->getJson('/api/v1/mande/data-quality')->assertOk()->json('data');
        $codes = collect($res['issues'])->pluck('code')->all();
        $this->assertContains('pif_without_me_record', $codes);
    }
}
