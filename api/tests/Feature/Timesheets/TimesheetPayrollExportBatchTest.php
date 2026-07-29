<?php

namespace Tests\Feature\Timesheets;

use App\Models\OvertimeAccrual;
use App\Models\OvertimeSettlement;
use App\Models\PayrollExportBatch;
use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetPeriod;
use App\Models\User;
use App\Models\OvertimeRatePolicy;
use App\Modules\Timesheets\Services\OvertimeService;
use App\Modules\Timesheets\Services\TimesheetPayrollExportService;
use Carbon\Carbon;
use Tests\TestCase;

class TimesheetPayrollExportBatchTest extends TestCase
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
     * @return array{tenant: Tenant, employee: User, supervisor: User, hr: User, finance: User, period: TimesheetPeriod, timesheet: Timesheet}
     */
    private function seedValidatedTimesheet(): array
    {
        $tenant = Tenant::factory()->create();

        OvertimeRatePolicy::create([
            'tenant_id' => $tenant->id,
            'day_type' => OvertimeRatePolicy::NORMAL_WORKING_DAY,
            'multiplier' => 1.5,
            'is_active' => true,
            'effective_from' => Carbon::parse($this->monday())->subYear()->toDateString(),
        ]);

        $employee = User::factory()->create([
            'tenant_id' => $tenant->id,
            'employee_number' => 'EMP-1001',
        ]);
        $employee->assignRole('staff');

        $supervisor = User::factory()->create(['tenant_id' => $tenant->id]);
        $supervisor->assignRole('HOD');

        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');

        $finance = User::factory()->create(['tenant_id' => $tenant->id]);
        $finance->assignRole('Finance Controller');

        $period = TimesheetPeriod::create([
            'tenant_id' => $tenant->id,
            'label' => 'W-test',
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
            'overtime_hours' => 2,
            'status' => 'approved',
            'approved_at' => now(),
            'hr_validated_at' => now(),
            'hr_validated_by' => $hr->id,
        ]);

        return compact('tenant', 'employee', 'supervisor', 'hr', 'finance', 'period', 'timesheet');
    }

    public function test_stage_export_marks_timesheets_idempotently_and_excludes_toil_from_pay_hours(): void
    {
        $ctx = $this->seedValidatedTimesheet();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $payActual = $this->makeHrValidatedActual($ot, $ctx, 'Pay mission');
        $ot->settle($payActual, $ctx['finance'], OvertimeSettlement::TYPE_PAY, 'pay-line-1');

        $toilEmployee = User::factory()->create([
            'tenant_id' => $ctx['tenant']->id,
            'employee_number' => 'EMP-2002',
        ]);
        $toilEmployee->assignRole('staff');

        $toilTimesheet = Timesheet::create([
            'tenant_id' => $ctx['tenant']->id,
            'period_id' => $ctx['period']->id,
            'user_id' => $toilEmployee->id,
            'week_start' => $this->monday(),
            'week_end' => $this->friday(),
            'week_number' => Carbon::parse($this->monday())->isoWeek(),
            'total_hours' => 40,
            'overtime_hours' => 2,
            'status' => 'approved',
            'approved_at' => now(),
            'hr_validated_at' => now(),
            'hr_validated_by' => $ctx['hr']->id,
        ]);

        $toilUsers = [
            'tenant' => $ctx['tenant'],
            'employee' => $toilEmployee,
            'supervisor' => $ctx['supervisor'],
            'hr' => $ctx['hr'],
            'finance' => $ctx['finance'],
        ];
        $toilActual = $this->makeHrValidatedActual($ot, $toilUsers, 'TOIL mission');
        $ot->settle($toilActual, $ctx['hr'], OvertimeSettlement::TYPE_TOIL, 'toil-line-1');

        /** @var TimesheetPayrollExportService $svc */
        $svc = app(TimesheetPayrollExportService::class);

        $batch1 = $svc->stageFromPeriod(
            $ctx['finance'],
            (int) $ctx['period']->id,
            'ts-payroll-batch-1',
            true,
        );
        $batch2 = $svc->stageFromPeriod(
            $ctx['finance'],
            (int) $ctx['period']->id,
            'ts-payroll-batch-1',
            true,
        );

        $this->assertSame($batch1->id, $batch2->id);
        $this->assertSame(PayrollExportBatch::EXPORTED, $batch1->status);

        $lines = $batch1->lines()->get();
        $this->assertGreaterThanOrEqual(3, $lines->count());

        $payHours = (float) $lines->sum(fn ($l) => (float) ($l->payable_hours ?? 0));
        // Ordinary 40 + 40 + PAY OT payable (2 * 1.5 = 3). TOIL must not add payable.
        $this->assertEquals(83.0, $payHours);

        $toilLines = $lines->where('settlement_flag', 'toil');
        $this->assertTrue($toilLines->isNotEmpty());
        $this->assertEquals(0.0, (float) $toilLines->sum('payable_hours'));

        $this->assertSame($batch1->id, (int) $ctx['timesheet']->fresh()->payroll_export_batch_id);
        $this->assertSame($batch1->id, (int) $toilTimesheet->fresh()->payroll_export_batch_id);

        $csv = $svc->exportCsv($batch1->fresh(['lines.user', 'period']));
        $this->assertStringContainsString('employee_id', $csv);
        $this->assertStringContainsString('EMP-1001', $csv);
        $this->assertStringContainsString('pay', $csv);
        $this->assertStringContainsString('toil', $csv);
        $this->assertStringNotContainsString('hourly_rate', strtolower($csv));
        $this->assertDatabaseCount('overtime_accruals', 1);
        $this->assertInstanceOf(OvertimeAccrual::class, OvertimeAccrual::first());
    }

    public function test_http_stage_endpoint_returns_batch_and_download(): void
    {
        $ctx = $this->seedValidatedTimesheet();

        $res = $this->actingAs($ctx['finance'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets/payroll-exports/stage', [
                'period_id' => $ctx['period']->id,
                'idempotency_key' => 'http-batch-1',
                'mark_included' => true,
            ])
            ->assertCreated();

        $batchId = $res->json('data.id');
        $this->assertNotEmpty($batchId);

        $download = $this->actingAs($ctx['finance'], 'sanctum')
            ->get("/api/v1/hr/timesheets/payroll-exports/{$batchId}/download?format=csv")
            ->assertOk();

        $contentType = strtolower((string) $download->headers->get('content-type'));
        $this->assertTrue(str_contains($contentType, 'text/csv'));
    }

    /**
     * @param  array{tenant: Tenant, employee: User, supervisor: User, hr: User, finance: User}  $users
     */
    private function makeHrValidatedActual(OvertimeService $ot, array $users, string $reason = 'Mission A')
    {
        $req = $ot->createRequisition($users['employee'], [
            'work_date' => $this->monday(),
            'planned_hours' => 2,
            'reason' => $reason,
            'day_type' => OvertimeRatePolicy::NORMAL_WORKING_DAY,
        ]);
        $ot->submitRequisition($req, $users['employee']);
        $ot->approveRequisition($req->fresh(), $users['supervisor']);
        $actual = $ot->recordActual($req->fresh(), $users['employee'], ['actual_hours' => 2]);

        return $ot->hrValidate($actual, $users['hr']);
    }
}
