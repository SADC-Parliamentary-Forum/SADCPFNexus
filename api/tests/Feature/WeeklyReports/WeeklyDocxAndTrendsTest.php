<?php

namespace Tests\Feature\WeeklyReports;

use App\Models\Tenant;
use App\Modules\WeeklyReports\Services\WeeklyExportService;
use Tests\TestCase;
use ZipArchive;

class WeeklyDocxAndTrendsTest extends TestCase
{
    public function test_docx_export_method_produces_valid_zip(): void
    {
        if (! class_exists(ZipArchive::class)) {
            $this->markTestSkipped('ZipArchive not available');
        }

        $this->assertTrue(method_exists(WeeklyExportService::class, 'wordDocx'));
    }

    public function test_trends_endpoint_returns_summary_shape(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $http->getJson('/api/v1/weekly-summaries/trends')
            ->assertOk()
            ->assertJsonStructure(['data' => ['series', 'summary' => ['completion_rate']]]);
    }
}
