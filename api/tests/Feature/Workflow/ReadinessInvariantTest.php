<?php

namespace Tests\Feature\Workflow;

use App\Models\LeaveRequest;
use App\Models\LeaveBalance;
use App\Models\SalaryAdvanceRequest;
use App\Models\Tenant;
use Tests\TestCase;

class ReadinessInvariantTest extends TestCase
{
    public function test_requester_cannot_approve_own_leave_request(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        LeaveBalance::query()->updateOrCreate(
            ['user_id' => $user->id, 'period_year' => (int) date('Y')],
            ['annual_balance_days' => 30, 'lil_hours_available' => 0, 'sick_leave_used_days' => 0]
        );

        $create = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(7)->toDateString(),
            'end_date' => now()->addDays(8)->toDateString(),
            'reason' => 'Readiness invariant test',
        ]);

        $create->assertCreated();
        $id = $create->json('data.id');
        $http->postJson("/api/v1/leave/requests/{$id}/submit")->assertOk();
        $http->postJson("/api/v1/leave/requests/{$id}/approve")
            ->assertStatus(403);
    }

    public function test_requester_cannot_approve_own_salary_advance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $advance = SalaryAdvanceRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $user->id,
            'reference_number' => 'ADV-READINESS-001',
            'advance_type' => 'medical',
            'amount' => 1000,
            'currency' => 'NAD',
            'purpose' => 'Invariant test',
            'justification' => 'Invariant test justification',
            'repayment_months' => 1,
            'status' => 'submitted',
        ]);

        $http->postJson("/api/v1/finance/advances/{$advance->id}/approve", [
            'comment' => 'Self approve attempt',
        ])->assertStatus(403);
    }

    public function test_only_assigned_approver_can_approve_submitted_leave(): void
    {
        $tenant = Tenant::factory()->create();
        [$staffHttp, $staff] = $this->asStaff($tenant);
        LeaveBalance::query()->updateOrCreate(
            ['user_id' => $staff->id, 'period_year' => (int) date('Y')],
            ['annual_balance_days' => 30, 'lil_hours_available' => 0, 'sick_leave_used_days' => 0]
        );

        $create = $staffHttp->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(11)->toDateString(),
            'reason' => 'Approver gate test',
        ]);

        $create->assertCreated();
        $id = $create->json('data.id');
        $staffHttp->postJson("/api/v1/leave/requests/{$id}/submit")->assertOk();

        [$randomStaff] = $this->asStaff($tenant);
        $randomStaff->postJson("/api/v1/leave/requests/{$id}/approve", [
            'comment' => 'Out of sequence attempt',
        ])->assertStatus(403);
    }
}
