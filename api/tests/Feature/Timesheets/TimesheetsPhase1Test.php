<?php

namespace Tests\Feature\Timesheets;

use App\Models\LeaveRequest;
use App\Models\OvertimeAccrual;
use App\Models\OvertimeActualEntry;
use App\Models\OvertimeRatePolicy;
use App\Models\OvertimeRequisition;
use App\Models\OvertimeSettlement;
use App\Models\Tenant;
use App\Models\Timesheet;
use App\Models\TimesheetEntry;
use App\Models\User;
use App\Modules\Timesheets\Services\OvertimeService;
use App\Modules\Timesheets\Services\TimesheetService;
use Carbon\Carbon;
use Tests\TestCase;

class TimesheetsPhase1Test extends TestCase
{
    private function monday(): string
    {
        return Carbon::now()->startOfWeek(Carbon::MONDAY)->toDateString();
    }

    private function friday(): string
    {
        return Carbon::now()->startOfWeek(Carbon::MONDAY)->addDays(4)->toDateString();
    }

    private function seedUsers(): array
    {
        $tenant = Tenant::factory()->create();
        $employee = User::factory()->create(['tenant_id' => $tenant->id]);
        $employee->assignRole('staff');
        $supervisor = User::factory()->create(['tenant_id' => $tenant->id]);
        $supervisor->assignRole('HOD');
        $hr = User::factory()->create(['tenant_id' => $tenant->id]);
        $hr->assignRole('HR Administrator');
        $finance = User::factory()->create(['tenant_id' => $tenant->id]);
        $finance->assignRole('Finance Controller');

        return compact('tenant', 'employee', 'supervisor', 'hr', 'finance');
    }

    public function test_default_schedule_expected_hours_mon_fri_eight_hours(): void
    {
        $users = $this->seedUsers();
        /** @var TimesheetService $svc */
        $svc = app(TimesheetService::class);

        $start = $this->monday();
        $end = $this->friday();
        $result = $svc->calculateExpectedHours($users['employee'], $start, $end);

        $this->assertSame(40.0, $result['expected_hours']);
        $this->assertSame(8.0, $result['days'][$start]['expected']);
        $this->assertSame('working', $result['days'][$start]['status']);
    }

    public function test_leave_blocks_ordinary_work_entries(): void
    {
        $users = $this->seedUsers();
        $leaveDay = $this->monday();

        LeaveRequest::create([
            'tenant_id' => $users['tenant']->id,
            'requester_id' => $users['employee']->id,
            'reference_number' => 'LV-TEST-'.uniqid(),
            'leave_type' => 'annual',
            'start_date' => $leaveDay,
            'end_date' => $leaveDay,
            'days_requested' => 1,
            'status' => 'approved',
            'reason' => 'Annual leave',
        ]);

        $this->actingAs($users['employee'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets', [
                'week_start' => $this->monday(),
                'week_end' => $this->friday(),
                'entries' => [
                    [
                        'work_date' => $leaveDay,
                        'hours' => 8,
                        'source_type' => 'manual',
                        'description' => 'Should be blocked',
                    ],
                ],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['entries.0.work_date']);
    }

    public function test_overlapping_time_entries_are_blocked(): void
    {
        $users = $this->seedUsers();
        $day = $this->monday();

        $this->actingAs($users['employee'], 'sanctum')
            ->postJson('/api/v1/hr/timesheets', [
                'week_start' => $this->monday(),
                'week_end' => $this->friday(),
                'entries' => [
                    [
                        'work_date' => $day,
                        'hours' => 3,
                        'start_time' => '08:00',
                        'end_time' => '11:00',
                        'description' => 'A',
                    ],
                    [
                        'work_date' => $day,
                        'hours' => 2,
                        'start_time' => '10:00',
                        'end_time' => '12:00',
                        'description' => 'Overlap',
                    ],
                ],
            ])
            ->assertUnprocessable();
    }

    public function test_employee_cannot_self_approve_timesheet(): void
    {
        $users = $this->seedUsers();
        $timesheet = Timesheet::create([
            'tenant_id' => $users['tenant']->id,
            'user_id' => $users['employee']->id,
            'week_start' => $this->monday(),
            'week_end' => $this->friday(),
            'week_number' => Carbon::parse($this->monday())->isoWeek(),
            'total_hours' => 8,
            'overtime_hours' => 0,
            'status' => 'submitted',
            'submitted_at' => now(),
        ]);
        TimesheetEntry::create([
            'timesheet_id' => $timesheet->id,
            'work_date' => $this->monday(),
            'hours' => 8,
            'overtime_hours' => 0,
            'source_type' => 'manual',
        ]);

        $this->actingAs($users['employee'], 'sanctum')
            ->postJson("/api/v1/hr/timesheets/{$timesheet->id}/approve")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['approval']);
    }

    public function test_overtime_advance_gate_blocks_actual_before_approval(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $req = $ot->createRequisition($users['employee'], [
            'work_date' => $this->monday(),
            'planned_hours' => 2,
            'reason' => 'Board prep',
            'day_type' => OvertimeRatePolicy::NORMAL_WORKING_DAY,
        ]);
        $ot->submitRequisition($req, $users['employee']);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $ot->recordActual($req->fresh(), $users['employee'], [
            'actual_hours' => 2,
            'work_date' => $this->monday(),
        ]);
    }

    public function test_planned_and_actual_overtime_are_separate_records(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $req = $ot->createRequisition($users['employee'], [
            'work_date' => $this->monday(),
            'planned_hours' => 3,
            'reason' => 'Mission report',
            'day_type' => OvertimeRatePolicy::NORMAL_WORKING_DAY,
        ]);
        $ot->submitRequisition($req, $users['employee']);
        $ot->approveRequisition($req->fresh(), $users['supervisor']);

        $actual = $ot->recordActual($req->fresh(), $users['employee'], [
            'actual_hours' => 2.5,
            'work_date' => $this->monday(),
        ]);

        $this->assertSame(3.0, (float) $req->fresh()->planned_hours);
        $this->assertSame(2.5, (float) $actual->actual_hours);
        $this->assertNotEquals($req->id, $actual->id);
        $this->assertDatabaseHas('overtime_requisitions', ['id' => $req->id, 'planned_hours' => 3]);
        $this->assertDatabaseHas('overtime_actual_entries', ['id' => $actual->id, 'actual_hours' => 2.5]);
    }

    public function test_normal_working_day_uses_one_point_five_multiplier(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $mult = $ot->resolveMultiplier((int) $users['tenant']->id, OvertimeRatePolicy::NORMAL_WORKING_DAY);
        $this->assertSame(1.5, $mult);

        $req = $ot->createRequisition($users['employee'], [
            'work_date' => $this->monday(),
            'planned_hours' => 2,
            'reason' => 'OT',
        ]);
        $ot->submitRequisition($req, $users['employee']);
        $ot->approveRequisition($req->fresh(), $users['supervisor']);
        $actual = $ot->recordActual($req->fresh(), $users['employee'], ['actual_hours' => 2]);

        $this->assertSame(1.5, (float) $actual->multiplier);
        $this->assertSame(3.0, (float) $actual->payable_hours);
    }

    public function test_unconfigured_weekend_rate_is_not_invented(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);
        $ot->ensureDefaultRatePolicy((int) $users['tenant']->id);

        $mult = $ot->resolveMultiplier((int) $users['tenant']->id, OvertimeRatePolicy::WEEKEND);
        $this->assertNull($mult);

        $req = $ot->createRequisition($users['employee'], [
            'work_date' => Carbon::parse($this->monday())->next(Carbon::SATURDAY)->toDateString(),
            'planned_hours' => 2,
            'reason' => 'Weekend work',
            'day_type' => OvertimeRatePolicy::WEEKEND,
        ]);
        $ot->submitRequisition($req, $users['employee']);
        $ot->approveRequisition($req->fresh(), $users['supervisor']);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $ot->recordActual($req->fresh(), $users['employee'], [
            'actual_hours' => 2,
            'day_type' => OvertimeRatePolicy::WEEKEND,
        ]);
    }

    public function test_cannot_double_settle_pay_and_toil(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $actual = $this->makeHrValidatedActual($ot, $users);

        $pay = $ot->settle($actual, $users['finance'], OvertimeSettlement::TYPE_PAY, 'idem-pay-1');
        $this->assertSame(OvertimeSettlement::TYPE_PAY, $pay->settlement_type);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $ot->settle($actual->fresh(), $users['hr'], OvertimeSettlement::TYPE_TOIL, 'idem-toil-1');
    }

    public function test_toil_and_payroll_send_are_idempotent(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $actual = $this->makeHrValidatedActual($ot, $users);

        $first = $ot->settle($actual, $users['hr'], OvertimeSettlement::TYPE_TOIL, 'idem-toil-x');
        $second = $ot->settle($actual->fresh(), $users['hr'], OvertimeSettlement::TYPE_TOIL, 'idem-toil-x');
        $this->assertSame($first->id, $second->id);
        $this->assertSame(1, OvertimeSettlement::where('overtime_actual_id', $actual->id)->count());
        $this->assertSame(1, OvertimeAccrual::where('code', 'OT-TOIL-'.$actual->id)->count());

        // Fresh actual for payroll idempotency
        $actualPay = $this->makeHrValidatedActual($ot, $users, 'Mission B');
        $s1 = $ot->settle($actualPay, $users['finance'], OvertimeSettlement::TYPE_PAY, 'idem-pay-x');
        $batch1 = $ot->exportPayroll($users['finance'], [$s1->id], 'batch-key-1');
        $batch2 = $ot->exportPayroll($users['finance'], [$s1->id], 'batch-key-1');
        $this->assertSame($batch1->id, $batch2->id);
        $this->assertSame(1, $batch1->lines()->count());
    }

    public function test_self_approve_overtime_forbidden(): void
    {
        $users = $this->seedUsers();
        /** @var OvertimeService $ot */
        $ot = app(OvertimeService::class);

        $req = $ot->createRequisition($users['employee'], [
            'work_date' => $this->monday(),
            'planned_hours' => 2,
            'reason' => 'Self approve attempt',
        ]);
        $ot->submitRequisition($req, $users['employee']);

        $this->expectException(\Illuminate\Validation\ValidationException::class);
        $ot->approveRequisition($req->fresh(), $users['employee']);
    }

    /**
     * @param  array{tenant: Tenant, employee: User, supervisor: User, hr: User, finance: User}  $users
     */
    private function makeHrValidatedActual(OvertimeService $ot, array $users, string $reason = 'Mission A'): OvertimeActualEntry
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
