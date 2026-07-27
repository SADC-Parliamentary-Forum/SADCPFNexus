<?php

namespace Tests\Feature\Leave;

use App\Models\HolidayCalendar;
use App\Models\LeaveLedgerEntry;
use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\ToilCredit;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use Carbon\Carbon;
use Tests\TestCase;

class LeavePhase1FoundationTest extends TestCase
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

    private function createSubmittedAnnualLeave(Tenant $tenant, int $userId): LeaveRequest
    {
        $this->openingBalance($tenant->id, $userId, 'annual', 20);
        $staff = \App\Models\User::findOrFail($userId);
        $start = now()->next(Carbon::MONDAY)->addWeeks(2);

        $created = $this->asUser($staff)->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDay()->toDateString(),
            'reason' => 'Certification test',
        ])->assertCreated();

        $this->asUser($staff)
            ->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertOk();

        return LeaveRequest::with('segments')->findOrFail($created->json('data.id'));
    }

    public function test_preview_excludes_public_holiday_and_returns_segment_balances(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->openingBalance($tenant->id, $user->id, 'annual', 10);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $holiday = $start->copy()->addDay();
        $calendar = HolidayCalendar::create([
            'tenant_id' => $tenant->id,
            'name' => 'Namibia',
            'country_code' => 'NA',
            'is_default' => true,
        ]);
        $calendar->dates()->create([
            'holiday_name' => 'Public Holiday',
            'date' => $holiday->toDateString(),
            'is_paid_holiday' => true,
        ]);

        $response = $http->postJson('/api/v1/leave/preview', [
            'segments' => [[
                'leave_type' => 'annual',
                'start_date' => $start->toDateString(),
                'end_date' => $start->copy()->addDays(4)->toDateString(),
            ]],
        ]);

        $response->assertOk()
            ->assertJsonPath('data.segments.0.public_holidays_excluded', 1)
            ->assertJsonPath('data.segments.0.amount_requested', 4)
            ->assertJsonPath('data.segments.0.balance_before', 10)
            ->assertJsonPath('data.segments.0.balance_after', 6);
    }

    public function test_one_leave_application_can_contain_annual_and_toil_segments(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->openingBalance($tenant->id, $user->id, 'annual', 12);

        $credit = ToilCredit::create([
            'tenant_id' => $tenant->id,
            'user_id' => $user->id,
            'credit_reference' => 'TOIL-TEST-001',
            'source_type' => 'test',
            'source_id' => 1,
            'duty_date' => now()->subDays(5)->toDateString(),
            'earned_amount' => 16,
            'unit' => 'hours',
            'credited_days' => 2,
            'accrual_date' => now()->subDays(5)->toDateString(),
            'expiry_date' => now()->addDays(20)->toDateString(),
            'original_balance' => 2,
            'remaining_balance' => 2,
            'status' => ToilCredit::AVAILABLE,
        ]);
        $this->openingBalance($tenant->id, $user->id, 'lil', 2);

        $start = now()->next(Carbon::MONDAY)->addWeeks(3);

        $response = $http->postJson('/api/v1/leave/requests', [
            'reason' => 'Annual leave followed by TOIL',
            'segments' => [
                [
                    'leave_type' => 'annual',
                    'start_date' => $start->toDateString(),
                    'end_date' => $start->copy()->addDay()->toDateString(),
                ],
                [
                    'leave_type' => 'lil',
                    'start_date' => $start->copy()->addDays(2)->toDateString(),
                    'end_date' => $start->copy()->addDays(3)->toDateString(),
                    'source_type' => ToilCredit::class,
                    'source_id' => $credit->id,
                ],
            ],
        ]);

        $response->assertCreated()
            ->assertJsonPath('data.status', 'draft')
            ->assertJsonCount(2, 'data.segments')
            ->assertJsonPath('data.days_requested', 4);

        $this->assertDatabaseHas('leave_segments', [
            'leave_request_id' => $response->json('data.id'),
            'leave_type' => 'annual',
            'amount_requested' => '2.00',
        ]);
        $this->assertDatabaseHas('leave_segments', [
            'leave_request_id' => $response->json('data.id'),
            'leave_type' => 'lil',
            'source_id' => $credit->id,
        ]);
    }

    public function test_annual_leave_submit_rejects_insufficient_ledger_balance(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $this->openingBalance($tenant->id, $user->id, 'annual', 1);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);
        $created = $http->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => $start->toDateString(),
            'end_date' => $start->copy()->addDays(2)->toDateString(),
            'reason' => 'Too much leave',
        ])->assertCreated();

        $http->postJson('/api/v1/leave/requests/' . $created->json('data.id') . '/submit')
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['balance']);
    }

    public function test_expired_travel_toil_candidate_cannot_be_used_for_leave_in_lieu(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $user->id,
        ]);

        $candidate = TravelToilCandidate::create([
            'tenant_id' => $tenant->id,
            'travel_request_id' => $travel->id,
            'user_id' => $user->id,
            'candidate_date' => now()->subDays(35)->toDateString(),
            'hours' => 8,
            'reason' => 'Weekend duty',
            'status' => TravelToilCandidate::STATUS_CREDITED,
            'credited_at' => now()->subDays(35),
            'expires_at' => now()->subDay()->toDateString(),
            'hr_validated_at' => now()->subDays(35),
        ]);

        $start = now()->next(Carbon::MONDAY)->addWeeks(2);

        $http->postJson('/api/v1/leave/requests', [
            'reason' => 'Use expired TOIL',
            'segments' => [[
                'leave_type' => 'lil',
                'start_date' => $start->toDateString(),
                'end_date' => $start->toDateString(),
                'source_type' => TravelToilCandidate::class,
                'source_id' => $candidate->id,
            ]],
        ])->assertUnprocessable()
          ->assertJsonValidationErrors(['toil']);
    }

    public function test_hod_can_record_recommendation_and_move_to_hr_certification_stage(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hod = $this->makeUser('HOD', $tenant);
        $leave = $this->createSubmittedAnnualLeave($tenant, $staff->id);

        $this->asUser($hod)
            ->postJson("/api/v1/leave/requests/{$leave->id}/recommend", [
                'action' => 'recommend',
                'comment' => 'Operationally covered',
            ])
            ->assertOk()
            ->assertJsonPath('data.recommendation_status', 'recommended')
            ->assertJsonPath('data.current_stage', 'Administration/HR Certification');

        $this->assertDatabaseHas('leave_requests', [
            'id' => $leave->id,
            'recommended_by' => $hod->id,
            'recommendation_status' => 'recommended',
        ]);
    }

    public function test_hr_can_certify_each_segment_with_eligible_days_and_document_status(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeHrAdmin($tenant);
        $leave = $this->createSubmittedAnnualLeave($tenant, $staff->id);
        $segment = $leave->segments->first();

        $this->asUser($hr)
            ->postJson("/api/v1/leave/requests/{$leave->id}/certify", [
                'action' => 'certify',
                'comment' => 'Balance and documents confirmed',
                'segments' => [[
                    'id' => $segment->id,
                    'eligible_days' => 2,
                    'document_status' => 'not_required',
                    'comments' => 'Annual leave entitlement confirmed',
                ]],
            ])
            ->assertOk()
            ->assertJsonPath('data.certification_status', 'certified')
            ->assertJsonPath('data.current_stage', 'Head of Institution Authorisation')
            ->assertJsonPath('data.segments.0.certification_status', 'certified')
            ->assertJsonPath('data.segments.0.document_status', 'not_required');

        $this->assertDatabaseHas('leave_segments', [
            'id' => $segment->id,
            'certification_status' => 'certified',
            'eligible_days' => '2.00',
            'certified_by' => $hr->id,
        ]);
    }

    public function test_requester_cannot_self_certify_leave(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $staff->givePermissionTo('leave.approve');
        $leave = $this->createSubmittedAnnualLeave($tenant, $staff->id);

        $this->asUser($staff)
            ->postJson("/api/v1/leave/requests/{$leave->id}/certify", [
                'action' => 'certify',
            ])
            ->assertForbidden();
    }
}
