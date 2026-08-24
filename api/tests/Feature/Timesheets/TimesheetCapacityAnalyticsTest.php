<?php

namespace Tests\Feature\Timesheets;

use App\Models\Tenant;
use App\Models\Timesheet;
use Tests\TestCase;

class TimesheetCapacityAnalyticsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['access_control.endpoint_enforcement_mode' => 'off']);
    }

    public function test_capacity_analytics_uses_recorded_hours_not_invented_ot_rates(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $weekStart = now()->startOfWeek()->toDateString();
        $weekEnd = now()->startOfWeek()->addDays(4)->toDateString();

        Timesheet::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'week_start' => $weekStart,
            'week_end' => $weekEnd,
            'week_number' => (int) now()->startOfWeek()->isoWeek(),
            'total_hours' => 32,
            'expected_hours' => 40,
            'overtime_hours' => 0,
            'status' => 'submitted',
        ]);

        $payload = $http->getJson('/api/v1/hr/timesheets/capacity-analytics?week_start='.$weekStart.'&week_end='.$weekEnd)
            ->assertOk()
            ->json('data');

        $this->assertArrayNotHasKey('overtime_rate', $payload);
        $this->assertArrayNotHasKey('ot_rate', $payload);
        $this->assertSame(false, $payload['invented_ot_rates']);
        $row = collect($payload['people'])->firstWhere('user_id', $user->id);
        $this->assertNotNull($row);
        $this->assertEquals(32, (float) $row['recorded_hours']);
        $this->assertEquals(40, (float) $row['expected_hours']);
        $this->assertEquals(80.0, (float) $row['utilization_pct']);
        $this->assertSame(['name', 'recorded_hours', 'expected_hours', 'utilization_pct'], $payload['csv_columns']);
        $this->assertArrayNotHasKey('overtime_pay', $payload);
    }
}
