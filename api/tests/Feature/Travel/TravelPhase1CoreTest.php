<?php

namespace Tests\Feature\Travel;

use App\Models\DelegatedAuthority;
use App\Models\DsaRate;
use App\Models\LeaveRequest;
use App\Models\Programme;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use Carbon\Carbon;
use Tests\TestCase;

class TravelPhase1CoreTest extends TestCase
{
    private function travelPayload(array $overrides = []): array
    {
        return array_merge([
            'purpose'             => 'Attend regional meeting',
            'departure_date'      => now()->addDays(7)->toDateString(),
            'return_date'         => now()->addDays(10)->toDateString(),
            'destination_country' => 'Namibia',
            'destination_city'    => 'Windhoek',
            'estimated_dsa'       => 1500.00,
            'currency'            => 'NAD',
            'cabin_class'         => 'economy',
            'host_organization'   => 'SADC Secretariat',
            'vehicle_type'        => 'sedan',
            'driver_required'     => true,
            'driver_name'         => 'John Driver',
            'funding_details'     => [
                [
                    'item'           => 'Air tickets',
                    'forum_amount'   => 5000,
                    'host_amount'    => 0,
                    'funding_agency' => 'SADC PF',
                ],
            ],
        ], $overrides);
    }

    private function attachDoc(TravelRequest $travel, int $userId, string $type): void
    {
        $travel->attachments()->create([
            'tenant_id'         => $travel->tenant_id,
            'uploaded_by'       => $userId,
            'original_filename' => "{$type}.pdf",
            'storage_path'      => "travel/{$travel->id}/{$type}.pdf",
            'mime_type'         => 'application/pdf',
            'size_bytes'        => 100,
            'document_type'     => $type,
        ]);
    }

    public function test_create_persists_pif_funding_and_vehicle(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);

        $programme = Programme::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title' => 'Test PIF',
            'status' => 'approved',
            'approved_at' => now(),
        ]);

        $response = $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'programme_id' => $programme->id,
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.host_organization', 'SADC Secretariat')
            ->assertJsonPath('data.vehicle_type', 'sedan')
            ->assertJsonPath('data.programme_id', $programme->id)
            ->assertJsonPath('data.cabin_class', 'economy');

        $id = $response->json('data.id');
        $this->assertDatabaseHas('travel_funding_lines', [
            'travel_request_id' => $id,
            'item'              => 'Air tickets',
        ]);
    }

    public function test_submit_without_invitation_agenda_returns_422(): void
    {
        [$http] = $this->asStaff();
        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $create->assertCreated();
        $id = $create->json('data.id');

        $http->postJson("/api/v1/travel/requests/{$id}/submit")
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['attachments']);
    }

    public function test_submit_with_invitation_and_agenda_succeeds(): void
    {
        [$http, $user] = $this->asStaff();
        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $id = $create->json('data.id');
        $travel = TravelRequest::findOrFail($id);

        $this->attachDoc($travel, $user->id, 'invitation');
        $this->attachDoc($travel, $user->id, 'agenda');

        $http->postJson("/api/v1/travel/requests/{$id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');
    }

    public function test_show_includes_workflow_and_funding(): void
    {
        [$http] = $this->asStaff();
        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $id = $create->json('data.id');

        $http->getJson("/api/v1/travel/requests/{$id}")
            ->assertOk()
            ->assertJsonPath('data.funding_lines.0.item', 'Air tickets')
            ->assertJsonStructure(['data', 'workflow', 'retirement_overdue']);
    }

    public function test_mark_booked_before_sg_approve_returns_422(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $id = $create->json('data.id');

        $http->postJson("/api/v1/travel/requests/{$id}/mark-booked")
            ->assertUnprocessable();
    }

    public function test_emergency_commit_requires_sg(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);
        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $id = $create->json('data.id');

        $http->postJson("/api/v1/travel/requests/{$id}/mark-booked", [
            'emergency_commit' => true,
            'emergency_reason' => 'Urgent mission',
        ])->assertUnprocessable();

        $sg = $this->makeUser('Secretary General', $tenant);
        $travel = TravelRequest::findOrFail($id);
        $this->attachDoc($travel, $sg->id, 'flight_ticket');

        $this->asUser($sg)->postJson("/api/v1/travel/requests/{$id}/mark-booked", [
            'emergency_commit' => true,
            'emergency_reason' => 'SG emergency authorisation',
        ])->assertOk()
          ->assertJsonPath('data.is_emergency', true);
    }

    public function test_finance_dsa_rate_types_and_personal_days_excluded(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        DsaRate::create([
            'tenant_id' => $tenant->id,
            'country' => 'Namibia',
            'city' => 'Windhoek',
            'rate_type' => 2,
            'rate_per_day' => 100,
            'accommodation_component' => 60,
            'meal_component' => 30,
            'incidentals_component' => 10,
            'is_active' => true,
            'currency' => 'USD',
        ]);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'submitted',
            'destination_country' => 'Namibia',
            'destination_city' => 'Windhoek',
            'departure_date' => now()->addDays(7)->toDateString(),
            'return_date' => now()->addDays(9)->toDateString(),
            'official_personal_days' => [
                ['date' => now()->addDays(9)->toDateString(), 'type' => 'personal_extension'],
            ],
        ]);

        $res = $this->asUser($finance)->postJson("/api/v1/travel/requests/{$travel->id}/dsa", [
            'rate_type' => 2,
            'lines' => [
                [
                    'date' => now()->addDays(7)->toDateString(),
                    'daily_rate' => 100,
                    'meal_deduction' => 30,
                    'rate_type' => 2,
                    'is_personal' => false,
                ],
                [
                    'date' => now()->addDays(8)->toDateString(),
                    'daily_rate' => 100,
                    'meal_deduction' => 0,
                    'rate_type' => 2,
                    'is_personal' => false,
                ],
                [
                    'date' => now()->addDays(9)->toDateString(),
                    'daily_rate' => 100,
                    'meal_deduction' => 0,
                    'rate_type' => 2,
                    'is_personal' => true,
                ],
            ],
        ]);

        $res->assertOk();
        $this->assertEquals(170.0, (float) $res->json('data.finance_dsa_total'));
        $this->assertDatabaseHas('travel_dsa_lines', [
            'travel_request_id' => $travel->id,
            'is_personal' => true,
            'daily_payable' => 0,
        ]);
    }

    public function test_non_finance_cannot_patch_dsa(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $user->id,
            'status' => 'submitted',
        ]);

        $http->postJson("/api/v1/travel/requests/{$travel->id}/dsa", [
            'rate_type' => 1,
            'lines' => [['date' => now()->toDateString(), 'daily_rate' => 50]],
        ])->assertForbidden();
    }

    public function test_toil_candidates_never_auto_create_leave(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $sat = now()->next(Carbon::SATURDAY);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $sat->toDateString(),
            'return_date' => $sat->copy()->addDays(2)->toDateString(),
        ]);

        $leaveBefore = LeaveRequest::count();

        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned")
            ->assertOk();

        $this->assertGreaterThan(0, TravelToilCandidate::where('travel_request_id', $travel->id)->count());
        $this->assertSame($leaveBefore, LeaveRequest::count());
        $this->assertFalse(config('travel.auto_create_leave_from_travel'));
    }

    public function test_toil_credit_requires_ot_authorisation(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
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
            'status' => TravelToilCandidate::STATUS_CANDIDATE,
        ]);

        $this->asUser($hr)->postJson("/api/v1/travel/toil/{$candidate->id}/hr-validate")
            ->assertUnprocessable();
    }

    public function test_toil_hr_validate_credits_with_30_day_expiry(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);
        $supervisor = $this->makeUser('HOD', $tenant);
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
            'status' => TravelToilCandidate::STATUS_CANDIDATE,
        ]);

        $this->asUser($supervisor)->postJson("/api/v1/travel/toil/{$candidate->id}/authorise-ot")->assertOk();
        $this->asUser($supervisor)->postJson("/api/v1/travel/toil/{$candidate->id}/confirm-duty")->assertOk();
        $res = $this->asUser($hr)->postJson("/api/v1/travel/toil/{$candidate->id}/hr-validate")->assertOk();

        $this->assertSame(TravelToilCandidate::STATUS_CREDITED, $res->json('data.status'));
        $this->assertNotNull($res->json('data.expires_at'));
        $this->assertNotNull($res->json('data.overtime_accrual_id'));
        $this->assertDatabaseHas('overtime_accruals', [
            'id' => $res->json('data.overtime_accrual_id'),
            'user_id' => $staff->id,
            'is_verified' => true,
        ]);
        $this->assertSame(0, LeaveRequest::where('requester_id', $staff->id)->where('leave_type', 'lil')->count());
    }

    public function test_retirement_due_at_is_return_plus_5_working_days(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $return = now()->next(Carbon::WEDNESDAY);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'departure_date' => $return->copy()->subDays(3)->toDateString(),
            'return_date' => $return->toDateString(),
        ]);

        $res = $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/mark-returned")->assertOk();
        $due = $res->json('data.retirement_due_at');
        $expected = app(\App\Modules\Travel\Services\TravelService::class)
            ->addWorkingDays($return->copy()->startOfDay(), 5)
            ->toDateString();
        $this->assertSame($expected, Carbon::parse($due)->toDateString());
    }

    public function test_amendment_required_for_approved_date_change(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asStaff($tenant);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $user->id,
        ]);

        $http->putJson("/api/v1/travel/requests/{$travel->id}", [
            'departure_date' => now()->addDays(20)->toDateString(),
        ])->assertUnprocessable();

        $http->postJson("/api/v1/travel/requests/{$travel->id}/amendments", [
            'changes' => ['departure_date' => now()->addDays(20)->toDateString()],
            'reason' => 'Meeting postponed',
        ])->assertCreated()
          ->assertJsonPath('data.status', 'submitted');

        $this->assertDatabaseHas('travel_requests', [
            'id' => $travel->id,
            'status' => 'amendment_pending',
        ]);
    }

    public function test_delegate_creates_request_on_behalf_of_principal(): void
    {
        $tenant = Tenant::factory()->create();
        $principal = $this->makeUser('staff', $tenant);
        $delegate = $this->makeUser('staff', $tenant);
        $delegate->givePermissionTo('travel.prepare-for-others');

        DelegatedAuthority::create([
            'tenant_id' => $tenant->id,
            'principal_user_id' => $principal->id,
            'delegate_user_id' => $delegate->id,
            'start_date' => now()->subDay()->toDateString(),
            'end_date' => now()->addDays(7)->toDateString(),
            'module' => 'travel',
            'can_draft' => true,
            'can_submit' => true,
            'can_upload' => true,
            'can_act_on_behalf' => true,
            'created_by' => $principal->id,
        ]);

        $res = $this->asUser($delegate)->postJson('/api/v1/travel/requests', $this->travelPayload([
            'prepared_on_behalf_of' => $principal->id,
        ]));

        $res->assertCreated()
            ->assertJsonPath('data.requester_id', $principal->id)
            ->assertJsonPath('data.prepared_by', $delegate->id)
            ->assertJsonPath('data.prepared_on_behalf_of', $principal->id);
    }
}
