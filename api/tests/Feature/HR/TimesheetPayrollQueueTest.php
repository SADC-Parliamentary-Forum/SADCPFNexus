<?php

namespace Tests\Feature\Hr;

use App\Models\Tenant;
use App\Models\TimesheetPeriod;
use Tests\TestCase;

/**
 * Payroll operator queue: stage from selectable period, not pasted settlement IDs.
 */
class TimesheetPayrollQueueTest extends TestCase
{
    public function test_payroll_exports_list_and_stage_from_period(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);
        $user->givePermissionTo([
            'timesheets.view-team',
            'timesheets.export',
            'timesheets.admin',
            'overtime.send-payroll',
        ]);

        $period = TimesheetPeriod::create([
            'tenant_id' => $tenant->id,
            'label' => 'Jul 2026 OT',
            'period_start' => '2026-07-01',
            'period_end' => '2026-07-31',
            'status' => 'open',
        ]);

        // Empty period should still stage idempotently (or 422 with clear message).
        $response = $http->postJson('/api/v1/hr/timesheets/payroll-exports/stage', [
            'period_id' => $period->id,
            'idempotency_key' => 'gap-pack-payroll-'.uniqid(),
            'mark_included' => true,
            'lock_period' => false,
        ]);

        $this->assertContains($response->status(), [200, 201, 422]);

        $http->getJson('/api/v1/hr/timesheets/payroll-exports')
            ->assertOk();
    }
}
