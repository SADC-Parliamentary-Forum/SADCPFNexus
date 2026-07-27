<?php

namespace Tests\Feature\Leave;

use App\Models\HrPersonalFile;
use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\LeaveType;
use App\Models\Tenant;
use App\Modules\Leave\Services\LeavePolicyService;
use Carbon\Carbon;
use Tests\TestCase;

class LeavePolicyValidationTest extends TestCase
{
    private function openingBalance(int $tenantId, int $userId, string $type, float $amount): void
    {
        LeaveLedgerEntry::create([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'leave_type' => $type,
            'transaction_type' => LeaveLedgerEntry::OPENING_BALANCE,
            'amount' => $amount,
            'unit' => 'days',
            'effective_date' => now()->startOfYear()->toDateString(),
            'reason' => 'Test opening balance',
        ]);
    }

    public function test_unconfirmed_employee_cannot_submit_annual_leave(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->openingBalance($tenant->id, $user->id, 'annual', 10);

        HrPersonalFile::create([
            'tenant_id' => $tenant->id,
            'employee_id' => $user->id,
            'created_by' => $user->id,
            'probation_status' => 'on_probation',
        ]);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'Annual leave while on probation',
        ])->assertCreated();

        $http->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['confirmation_status']);
    }

    public function test_sick_leave_over_threshold_requires_certificate_status(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'sick',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDays(2)->toDateString(),
            'reason' => 'Sick leave',
        ])->assertCreated();

        $http->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['medical_certificate']);
    }

    public function test_study_leave_cannot_exceed_configured_annual_limit(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        app(LeavePolicyService::class)->activePolicyForTenant($tenant->id);
        LeaveType::where('tenant_id', $tenant->id)
            ->where('code', 'study')
            ->update(['annual_entitlement' => 3]);

        LeaveRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $user->id,
            'leave_type' => 'study',
            'start_date' => '2026-03-02',
            'end_date' => '2026-03-03',
            'days_requested' => 2,
            'status' => 'approved',
        ])->segments()->create([
            'leave_type' => 'study',
            'start_date' => '2026-03-02',
            'end_date' => '2026-03-03',
            'calendar_days' => 2,
            'working_days' => 2,
            'amount_requested' => 2,
        ]);

        $start = now()->next(Carbon::MONDAY)->addWeeks(3);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'study',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'Exam preparation',
        ])->assertCreated();

        $http->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['study']);
    }

    public function test_paternity_leave_requires_twelve_months_service(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        HrPersonalFile::create([
            'tenant_id' => $tenant->id,
            'employee_id' => $user->id,
            'created_by' => $user->id,
            'appointment_date' => now()->subMonths(6)->toDateString(),
            'probation_status' => 'confirmed',
        ]);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'paternity',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'Birth of child',
        ])->assertCreated();

        $http->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['paternity']);
    }
}
