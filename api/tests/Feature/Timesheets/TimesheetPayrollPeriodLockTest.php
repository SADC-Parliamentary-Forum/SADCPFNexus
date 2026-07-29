<?php

namespace Tests\Feature\Timesheets;

use App\Models\PayrollExportBatch;
use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetPeriod;
use App\Models\User;
use Carbon\Carbon;
use Tests\TestCase;

class TimesheetPayrollPeriodLockTest extends TestCase
{
    private function monday(): string
    {
        return Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function friday(): string
    {
        return Carbon::parse($this->monday())->addDays(4)->toDateString();
    }

    /**
     * @return array{tenant: Tenant, finance: User, period: TimesheetPeriod, timesheet: Timesheet}
     */
    private function seedLockedPeriodContext(): array
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create([
            'tenant_id' => $tenant->id,
            'employee_number' => 'EMP-LOCK-1',
        ]);
        $employee->assignRole('staff');

        $finance = User::factory()->create(['tenant_id' => $tenant->id]);
        $finance->assignRole('Finance Controller');

        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');

        $period = TimesheetPeriod::create([
            'tenant_id' => $tenant->id,
            'label' => 'W-lock',
            'period_start' => $this->monday(),
            'period_end' => $this->friday(),
            'status' => TimesheetPeriod::OPEN,
        ]);

        $timesheet = Timesheet::create([
            'tenant_id' => $tenant->id,
            'period_id' => $period->id,
            'user_id' => $employee->id,
            'week_start' => $this->monday(),
            'week_end' => $this->friday(),
            'week_number' => Carbon::parse($this->monday())->isoWeek(),
            'total_hours' => 40,
            'overtime_hours' => 0,
            'status' => 'approved',
            'approved_at' => now(),
            'hr_validated_at' => now(),
            'hr_validated_by' => $hr->id,
        ]);

        return compact('tenant', 'finance', 'period', 'timesheet');
    }

    public function test_stage_locks_period_and_lists_export_history(): void
    {
        $ctx = $this->seedLockedPeriodContext();

        $res = $this->actingAs($ctx['finance'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets/payroll-exports/stage', [
                'period_id' => $ctx['period']->id,
                'idempotency_key' => 'lock-batch-1',
                'mark_included' => true,
                'lock_period' => true,
            ])
            ->assertCreated();

        $batchId = (int) $res->json('data.id');
        $this->assertGreaterThan(0, $batchId);

        $this->assertSame(
            TimesheetPeriod::PAYROLL_EXPORTED,
            $ctx['period']->fresh()->status
        );

        $history = $this->actingAs($ctx['finance'], 'sanctum')
            ->getJson('/api/v1/hr/timesheets/payroll-exports')
            ->assertOk()
            ->json('data');

        $ids = collect($history)->pluck('id')->all();
        $this->assertContains($batchId, $ids);
    }

    public function test_locked_period_rejects_new_stage_with_different_key(): void
    {
        $ctx = $this->seedLockedPeriodContext();

        $this->actingAs($ctx['finance'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets/payroll-exports/stage', [
                'period_id' => $ctx['period']->id,
                'idempotency_key' => 'lock-first',
                'lock_period' => true,
            ])
            ->assertCreated();

        $this->actingAs($ctx['finance'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets/payroll-exports/stage', [
                'period_id' => $ctx['period']->id,
                'idempotency_key' => 'lock-second',
                'lock_period' => true,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['period_id']);

        $this->assertSame(1, PayrollExportBatch::query()->where('period_id', $ctx['period']->id)->count());
    }
}
