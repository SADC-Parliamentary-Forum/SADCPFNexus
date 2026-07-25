<?php

namespace Tests\Feature\MAndE;

use App\Models\MeActivityReport;
use App\Models\Tenant;
use Illuminate\Http\UploadedFile;
use OpenSpout\Writer\XLSX\Writer;
use OpenSpout\Common\Entity\Row;
use Tests\TestCase;

class MePhase2PolishDonorImportTest extends TestCase
{
    public function test_donor_report_accepts_status_and_thematic_filters(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        MeActivityReport::create([
            'tenant_id'      => $tenant->id,
            'non_pif_reason' => 'Donor filter fixture activity',
            'activity_title' => 'Donor filtered',
            'review_status'  => 'submitted',
            'created_by'     => $user->id,
            'responsible_officer_id' => $user->id,
            'start_date'     => now()->subDays(10)->toDateString(),
            'end_date'       => now()->subDays(5)->toDateString(),
        ]);

        $res = $http->getJson('/api/v1/mande/reports/donor?review_status=submitted')
            ->assertOk()
            ->json('data');

        $this->assertArrayHasKey('summary', $res);
        $this->assertArrayHasKey('by_status', $res['summary']);
        $this->assertNotEmpty($res['activities']);
        $this->assertTrue(collect($res['activities'])->every(fn ($a) => $a['review_status'] === 'submitted'));
    }

    public function test_xlsx_import_preview_and_commit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $path = tempnam(sys_get_temp_dir(), 'meimp') . '.xlsx';
        $writer = new Writer();
        $writer->openToFile($path);
        $writer->addRow(Row::fromValues([
            'activity_title', 'start_date', 'end_date', 'pif_number', 'non_pif_reason',
        ]));
        $writer->addRow(Row::fromValues([
            'Excel imported workshop', '2025-02-01', '2025-02-03', '', 'Historical Excel non-PIF import',
        ]));
        $writer->close();

        $file = new UploadedFile($path, 'import.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $http->post('/api/v1/mande/import/preview', ['file' => $file], [
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.valid', 1);

        $file2 = new UploadedFile($path, 'import.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', null, true);

        $http->post('/api/v1/mande/import/commit', ['file' => $file2], [
            'Accept' => 'application/json',
        ])->assertOk()
            ->assertJsonPath('data.created', 1);

        $this->assertDatabaseHas('me_activity_reports', [
            'tenant_id'      => $tenant->id,
            'activity_title' => 'Excel imported workshop',
        ]);

        @unlink($path);
    }
}
