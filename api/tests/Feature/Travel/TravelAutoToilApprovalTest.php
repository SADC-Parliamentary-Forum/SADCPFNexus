<?php

namespace Tests\Feature\Travel;

use App\Models\Department;
use App\Models\LeaveRequest;
use App\Models\Notification;
use App\Models\OvertimeAccrual;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TravelAutoToilApprovalTest extends TestCase
{
    use RefreshDatabase;

    public function test_config_locks_auto_generate_without_auto_leave(): void
    {
        $this->assertTrue(config('travel.auto_generate_candidates'));
        $this->assertFalse(config('travel.auto_create_leave_from_travel'));
        $this->assertSame(30, (int) config('travel.toil_expiry_days'));
        $this->assertSame(8.0, (float) config('travel.toil_hours_per_day'));
    }

    public function test_auto_calc_creates_pending_supervisor_candidate_without_leave(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);
        $supervisor = $this->makeUser('HOD', $tenant);

        $dept = Department::create([
            'tenant_id' => $tenant->id,
            'name' => 'Protocol',
            'code' => 'PRO',
            'supervisor_id' => $supervisor->id,
        ]);
        $staff->update(['department_id' => $dept->id]);

        $sat = now()->next(Carbon::SATURDAY);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $sat->toDateString(),
            'return_date' => $sat->copy()->addDay()->toDateString(),
        ]);

        $leaveBefore = LeaveRequest::count();
        $accrualBefore = OvertimeAccrual::count();

        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned")
            ->assertOk();

        $candidates = TravelToilCandidate::where('travel_request_id', $travel->id)->get();
        $this->assertGreaterThan(0, $candidates->count());
        $this->assertTrue($candidates->every(
            fn (TravelToilCandidate $c) => $c->status === TravelToilCandidate::STATUS_PENDING_SUPERVISOR
        ));
        $this->assertSame($leaveBefore, LeaveRequest::count());
        $this->assertSame($accrualBefore, OvertimeAccrual::count());

        $this->assertTrue(
            Notification::where('user_id', $staff->id)->where('trigger', 'travel.toil_candidate')->exists()
        );
        $this->assertTrue(
            Notification::where('user_id', $supervisor->id)
                ->where('trigger', 'travel.toil_approval_required')
                ->exists()
        );
        $this->assertTrue(
            Notification::where('user_id', $hr->id)
                ->where('trigger', 'travel.toil_approval_required')
                ->exists()
        );
    }

    public function test_leave_credited_only_after_supervisor_and_hr_approve(): void
    {
        [$staff, $supervisor, $hr, $candidate] = $this->seedPendingCandidate();

        $leaveBefore = LeaveRequest::where('requester_id', $staff->id)->count();

        $this->asUser($hr)->postJson("/api/v1/travel/toil/{$candidate->id}/hr-validate")
            ->assertUnprocessable();

        $this->asUser($supervisor)->postJson("/api/v1/travel/toil/{$candidate->id}/confirm-duty")
            ->assertOk()
            ->assertJsonPath('data.status', TravelToilCandidate::STATUS_PENDING_HR);

        $this->assertTrue(
            Notification::where('user_id', $hr->id)
                ->where('trigger', 'travel.toil_hr_validation_required')
                ->exists()
        );

        $res = $this->asUser($hr)->postJson("/api/v1/travel/toil/{$candidate->id}/hr-validate")
            ->assertOk();

        $this->assertSame(TravelToilCandidate::STATUS_CREDITED, $res->json('data.status'));
        $this->assertNotNull($res->json('data.overtime_accrual_id'));
        $this->assertSame($leaveBefore, LeaveRequest::where('requester_id', $staff->id)->count());

        $expectedExpiry = Carbon::parse($candidate->candidate_date)
            ->addDays((int) config('travel.toil_expiry_days', 30))
            ->toDateString();
        $this->assertSame($expectedExpiry, Carbon::parse($res->json('data.expires_at'))->toDateString());
    }

    public function test_reject_never_credits_leave(): void
    {
        [$staff, $supervisor, $hr, $candidate] = $this->seedPendingCandidate();

        $accrualBefore = OvertimeAccrual::count();
        $leaveBefore = LeaveRequest::count();

        $this->asUser($supervisor)->postJson("/api/v1/travel/toil/{$candidate->id}/reject", [
            'reason' => 'OT not authorised for this weekend',
        ])->assertOk()->assertJsonPath('data.status', TravelToilCandidate::STATUS_REJECTED);

        $this->assertSame($accrualBefore, OvertimeAccrual::count());
        $this->assertSame($leaveBefore, LeaveRequest::count());
        $this->assertNull($candidate->fresh()->overtime_accrual_id);
    }

    public function test_sg_extend_records_approver_expiry_and_reason(): void
    {
        [$staff, $supervisor, $hr, $candidate] = $this->seedPendingCandidate();
        $tenant = Tenant::findOrFail($candidate->tenant_id);
        $sg = $this->makeUser('Secretary General', $tenant);

        $this->asUser($supervisor)->postJson("/api/v1/travel/toil/{$candidate->id}/confirm-duty")->assertOk();
        $this->asUser($hr)->postJson("/api/v1/travel/toil/{$candidate->id}/hr-validate")->assertOk();

        $newExpiry = now()->addDays(60)->toDateString();
        $res = $this->asUser($sg)->postJson("/api/v1/travel/toil/{$candidate->id}/extend", [
            'expires_at' => $newExpiry,
            'reason' => 'Mission report delayed — SG authorised extension',
        ])->assertOk();

        $this->assertSame(TravelToilCandidate::STATUS_EXTENDED, $res->json('data.status'));
        $this->assertSame($newExpiry, Carbon::parse($res->json('data.expires_at'))->toDateString());
        $this->assertSame('Mission report delayed — SG authorised extension', $res->json('data.sg_extend_reason'));
        $this->assertSame($sg->id, $candidate->fresh()->sg_extended_by);

        $this->asUser($sg)->postJson("/api/v1/travel/toil/{$candidate->id}/extend", [
            'expires_at' => now()->addDays(90)->toDateString(),
        ])->assertUnprocessable();
    }

    public function test_expiry_job_marks_overdue_credited_as_expired(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);

        $candidate = TravelToilCandidate::create([
            'tenant_id' => $tenant->id,
            'travel_request_id' => $travel->id,
            'user_id' => $staff->id,
            'candidate_date' => now()->subDays(40)->toDateString(),
            'hours' => 8,
            'reason' => 'weekend',
            'status' => TravelToilCandidate::STATUS_CREDITED,
            'expires_at' => now()->subDay()->toDateString(),
            'credited_at' => now()->subDays(31),
        ]);

        $this->artisan('travel:generate-toil-candidates')->assertSuccessful();

        $this->assertSame(TravelToilCandidate::STATUS_EXPIRED, $candidate->fresh()->status);
    }

    /**
     * @return array{0: User, 1: User, 2: User, 3: TravelToilCandidate}
     */
    private function seedPendingCandidate(): array
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $supervisor = $this->makeUser('HOD', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);
        $candidate = TravelToilCandidate::create([
            'tenant_id' => $tenant->id,
            'travel_request_id' => $travel->id,
            'user_id' => $staff->id,
            'candidate_date' => now()->toDateString(),
            'hours' => 8,
            'reason' => 'weekend',
            'status' => TravelToilCandidate::STATUS_PENDING_SUPERVISOR,
        ]);

        return [$staff, $supervisor, $hr, $candidate];
    }
}
