<?php

namespace Tests\Feature\MAndE;

use App\Models\Indicator;
use App\Models\MeActivityReport;
use App\Models\ResultsFramework;
use App\Models\Tenant;
use Tests\TestCase;

class MePhase2PolishVersionsCalendarTest extends TestCase
{
    public function test_indicator_version_snapshot(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $framework = ResultsFramework::create([
            'tenant_id'  => $tenant->id,
            'name'       => 'Test RF',
            'type'       => 'institutional',
            'status'     => 'active',
            'created_by' => $user->id,
        ]);

        $indicator = Indicator::create([
            'tenant_id'            => $tenant->id,
            'results_framework_id' => $framework->id,
            'code'                 => 'IND-T1',
            'name'                 => 'Versioned indicator',
            'result_level'         => 'output',
            'unit'                 => 'number',
            'annual_target'        => 10,
            'created_by'           => $user->id,
            'is_active'            => true,
        ]);

        $http->postJson("/api/v1/mande/indicators/{$indicator->id}/versions", [
            'label'        => 'Baseline freeze',
            'change_notes' => 'Initial snapshot',
        ])->assertCreated()
            ->assertJsonPath('data.version_number', 1)
            ->assertJsonPath('data.snapshot.name', 'Versioned indicator');

        $http->getJson("/api/v1/mande/indicators/{$indicator->id}/versions")
            ->assertOk()
            ->assertJsonCount(1, 'data');
    }

    public function test_reporting_calendar_lists_due_items(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        MeActivityReport::create([
            'tenant_id'              => $tenant->id,
            'non_pif_reason'         => 'Calendar fixture activity',
            'activity_title'         => 'Due this month',
            'review_status'          => 'not_submitted',
            'created_by'             => $user->id,
            'responsible_officer_id' => $user->id,
            'report_due_at'          => now()->startOfMonth()->addDays(5),
        ]);

        $month = now()->format('Y-m');
        $res = $http->getJson("/api/v1/mande/calendar?month={$month}")
            ->assertOk()
            ->json('data');

        $this->assertSame($month, $res['month']);
        $this->assertNotEmpty($res['items']);
        $this->assertArrayHasKey('overdue_count', $res);
    }
}
