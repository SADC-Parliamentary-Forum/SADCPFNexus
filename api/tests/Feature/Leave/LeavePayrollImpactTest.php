<?php

namespace Tests\Feature\Leave;

use App\Models\HrPersonalFile;
use App\Models\LeavePayrollImpact;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\User;
use App\Modules\Leave\Services\LeaveService;
use Carbon\Carbon;
use Tests\TestCase;

class LeavePayrollImpactTest extends TestCase
{
    private function createSubmittedLeave(Tenant $tenant, User $staff, string $leaveType, Carbon $start, Carbon $end): LeaveRequest
    {
        $created = $this->asUser($staff)->postJson('/api/v1/leave/requests', [
            'leave_type' => $leaveType,
            'start_date' => $start->toDateString(),
            'end_date' => $end->toDateString(),
            'reason' => 'Payroll impact test',
        ])->assertCreated();

        $this->asUser($staff)
            ->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertOk();

        return LeaveRequest::with(['segments', 'requester'])->findOrFail($created->json('data.id'));
    }

    public function test_approved_leave_without_pay_creates_pending_payroll_impact(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $approver = $this->makeHrManager($tenant);
        $start = now()->next(Carbon::MONDAY)->addWeeks(2);

        $leave = $this->createSubmittedLeave($tenant, $staff, 'unpaid', $start, $start->copy()->addDay());

        $hod = $this->makeUser('HOD', $tenant);
        $sg = $this->makeSG($tenant);
        app(LeaveService::class)->recommend($leave, $hod, 'recommend');
        $leave->refresh();
        app(LeaveService::class)->certify($leave->fresh(), $approver, 'certify');
        app(LeaveService::class)->approve($leave->fresh(), $sg, 'Secretary General authorised leave without pay.');

        $this->assertDatabaseHas('leave_payroll_impacts', [
            'tenant_id' => $tenant->id,
            'leave_request_id' => $leave->id,
            'user_id' => $staff->id,
            'leave_type' => 'unpaid',
            'pay_treatment' => 'unpaid',
            'status' => 'pending',
        ]);

        $impact = LeavePayrollImpact::where('leave_request_id', $leave->id)->firstOrFail();
        $this->assertTrue($impact->payload['payroll_review_required']);
        $this->assertSame('authorised_leave_without_pay', $impact->payload['reason']);
    }

    public function test_approved_maternity_leave_creates_social_security_payroll_tracking_record(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $approver = $this->makeHrManager($tenant);

        HrPersonalFile::create([
            'tenant_id' => $tenant->id,
            'employee_id' => $staff->id,
            'created_by' => $staff->id,
            'appointment_date' => now()->subYear()->toDateString(),
            'probation_status' => 'confirmed',
        ]);

        $start = now()->next(Carbon::MONDAY)->addWeeks(6);
        $leave = $this->createSubmittedLeave($tenant, $staff, 'maternity', $start, $start->copy()->addDays(13));

        $hod = $this->makeUser('HOD', $tenant);
        $sg = $this->makeSG($tenant);
        app(LeaveService::class)->recommend($leave, $hod, 'recommend');
        app(LeaveService::class)->certify($leave->fresh(), $approver, 'certify');
        app(LeaveService::class)->approve($leave->fresh(), $sg, 'Approved maternity payroll review.');

        $this->assertDatabaseHas('leave_payroll_impacts', [
            'tenant_id' => $tenant->id,
            'leave_request_id' => $leave->id,
            'user_id' => $staff->id,
            'leave_type' => 'maternity',
            'pay_treatment' => 'maternity_social_security_review',
            'status' => 'pending',
        ]);

        $impact = LeavePayrollImpact::where('leave_request_id', $leave->id)->firstOrFail();
        $this->assertTrue($impact->payload['social_security_tracking_required']);
        $this->assertTrue($impact->payload['payroll_review_required']);
    }
}
