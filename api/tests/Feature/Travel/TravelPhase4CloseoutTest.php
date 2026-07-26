<?php

namespace Tests\Feature\Travel;

use App\Models\LeaveRequest;
use App\Models\Tenant;
use App\Models\TravelAccommodation;
use App\Models\TravelRequest;
use App\Models\TravelToilCandidate;
use Carbon\Carbon;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class TravelPhase4CloseoutTest extends TestCase
{
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

    public function test_submit_warns_on_overlapping_approved_leave_and_travel(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $departure = Carbon::now()->addDays(10)->toDateString();
        $return = Carbon::now()->addDays(14)->toDateString();

        LeaveRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'start_date' => Carbon::now()->addDays(12)->toDateString(),
            'end_date' => Carbon::now()->addDays(16)->toDateString(),
            'leave_type' => 'annual',
        ]);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'departure_date' => Carbon::now()->addDays(11)->toDateString(),
            'return_date' => Carbon::now()->addDays(13)->toDateString(),
        ]);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'draft',
            'departure_date' => $departure,
            'return_date' => $return,
        ]);
        $this->attachDoc($travel, $staff->id, 'invitation');
        $this->attachDoc($travel, $staff->id, 'agenda');

        $res = $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/submit");
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['conflicts']);
        $payload = $res->json('errors.conflicts');
        $this->assertIsArray($payload);
        $joined = implode(' ', $payload);
        $this->assertStringContainsString('leave', strtolower($joined));
        $this->assertStringContainsString('travel', strtolower($joined));
    }

    public function test_submit_allows_when_acknowledge_conflicts(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        LeaveRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'start_date' => Carbon::now()->addDays(12)->toDateString(),
            'end_date' => Carbon::now()->addDays(16)->toDateString(),
            'leave_type' => 'annual',
        ]);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'draft',
            'departure_date' => Carbon::now()->addDays(10)->toDateString(),
            'return_date' => Carbon::now()->addDays(14)->toDateString(),
        ]);
        $this->attachDoc($travel, $staff->id, 'invitation');
        $this->attachDoc($travel, $staff->id, 'agenda');

        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/submit", [
            'acknowledge_conflicts' => true,
            'conflict_resolution_note' => 'HR reviewed — personal leave shortened',
        ])->assertOk();

        $this->assertSame('submitted', $travel->fresh()->status);
    }

    public function test_leave_create_blocks_overlapping_approved_travel_without_hr_note(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'departure_date' => Carbon::now()->addDays(10)->toDateString(),
            'return_date' => Carbon::now()->addDays(14)->toDateString(),
        ]);

        $res = $this->asUser($staff)->postJson('/api/v1/leave/requests', [
            'leave_type' => 'annual',
            'start_date' => Carbon::now()->addDays(12)->toDateString(),
            'end_date' => Carbon::now()->addDays(13)->toDateString(),
            'reason' => 'Holiday',
        ]);
        $res->assertStatus(422);
        $res->assertJsonValidationErrors(['conflicts']);
    }

    public function test_role_dashboards_return_counts(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'draft',
            'departure_date' => Carbon::now()->addDays(20)->toDateString(),
            'return_date' => Carbon::now()->addDays(25)->toDateString(),
        ]);
        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'departure_date' => Carbon::now()->addDays(5)->toDateString(),
            'return_date' => Carbon::now()->addDays(8)->toDateString(),
            'approved_at' => now(),
            'retirement_due_at' => Carbon::now()->subDays(2)->toDateString(),
            'returned_at' => Carbon::now()->subDays(7),
            'retirement_status' => 'pending',
        ]);
        TravelToilCandidate::create([
            'travel_request_id' => TravelRequest::where('requester_id', $staff->id)->where('status', 'approved')->value('id'),
            'tenant_id' => $tenant->id,
            'user_id' => $staff->id,
            'candidate_date' => Carbon::now()->subDays(5)->toDateString(),
            'reason' => 'weekend',
            'status' => TravelToilCandidate::STATUS_CANDIDATE,
            'hours' => 8,
        ]);

        $traveller = $this->asUser($staff)->getJson('/api/v1/travel/dashboards/traveller')->assertOk();
        $this->assertGreaterThanOrEqual(1, $traveller->json('data.drafts'));
        $this->assertArrayHasKey('upcoming', $traveller->json('data'));
        $this->assertArrayHasKey('retirement_due', $traveller->json('data'));
        $this->assertArrayHasKey('toil_pending', $traveller->json('data'));

        $adminDash = $this->asUser($admin)->getJson('/api/v1/travel/dashboards/admin')->assertOk();
        $this->assertArrayHasKey('bookings_pending', $adminDash->json('data'));
        $this->assertArrayHasKey('visas_pending', $adminDash->json('data'));
        $this->assertArrayHasKey('departing_soon', $adminDash->json('data'));

        $finDash = $this->asUser($finance)->getJson('/api/v1/travel/dashboards/finance')->assertOk();
        $this->assertArrayHasKey('dsa_pending', $finDash->json('data'));
        $this->assertArrayHasKey('overdue_retirement', $finDash->json('data'));
        $this->assertArrayHasKey('cost_by_programme', $finDash->json('data'));
    }

    public function test_travel_calendar_lists_approved_away_and_returns(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeUser('Administration Officer', $tenant);
        $staff = $this->makeUser('staff', $tenant);

        TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'departure_date' => Carbon::now()->subDays(1)->toDateString(),
            'return_date' => Carbon::now()->addDays(3)->toDateString(),
            'approved_at' => now()->subDays(10),
        ]);

        $res = $this->asUser($admin)->getJson('/api/v1/travel/calendar?from='.Carbon::now()->subDays(7)->toDateString().'&to='.Carbon::now()->addDays(30)->toDateString())
            ->assertOk();

        $events = $res->json('data');
        $this->assertNotEmpty($events);
        $types = collect($events)->pluck('type')->unique()->all();
        $this->assertTrue(count(array_intersect($types, ['approved', 'away', 'departure', 'return'])) > 0);
    }

    public function test_accommodation_crud_and_mileage_comparison(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'vehicle_type' => 'private',
            'approved_at' => now(),
        ]);

        $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/accommodations", [
            'hotel_name' => 'Hilton Windhoek',
            'country' => 'Namibia',
            'city' => 'Windhoek',
            'check_in' => Carbon::now()->addDays(5)->toDateString(),
            'check_out' => Carbon::now()->addDays(8)->toDateString(),
            'room_type' => 'Single',
            'rate' => 1200,
            'currency' => 'NAD',
            'paid_by' => 'sadc_pf',
            'confirmation_number' => 'HTL-001',
        ])->assertCreated();

        $this->assertDatabaseHas('travel_accommodations', [
            'travel_request_id' => $travel->id,
            'hotel_name' => 'Hilton Windhoek',
            'confirmation_number' => 'HTL-001',
        ]);

        $this->asUser($admin)->patchJson("/api/v1/travel/requests/{$travel->id}/vehicle-mileage", [
            'private_vehicle_reason' => 'No SADC PF vehicle available',
            'private_vehicle_route' => 'WDH-OTJ-WDH',
            'estimated_kilometres' => 1000,
            'mileage_rate_per_km' => 4.5,
            'equivalent_airfare' => 3500,
        ])->assertOk();

        $travel->refresh();
        $this->assertEquals(4500.0, (float) $travel->mileage_reimbursement_estimate);
        $this->assertEquals(3500.0, (float) $travel->reimbursement_capped_amount);
        $this->assertTrue((bool) $travel->mileage_exceeds_airfare);
    }

    public function test_travel_pack_download_available_after_booking(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'approved',
            'approved_at' => now(),
            'booking_committed_at' => now(),
        ]);

        TravelAccommodation::create([
            'travel_request_id' => $travel->id,
            'hotel_name' => 'Test Hotel',
            'country' => 'Namibia',
            'city' => 'Windhoek',
            'check_in' => Carbon::now()->addDays(2)->toDateString(),
            'check_out' => Carbon::now()->addDays(5)->toDateString(),
            'paid_by' => 'host',
        ]);

        $res = $this->asUser($staff)->get("/api/v1/travel/requests/{$travel->id}/travel-pack");
        $res->assertOk();
        $disposition = (string) $res->headers->get('content-disposition');
        $this->assertStringContainsString('TRAVEL-PACK', $disposition);
        $file = $res->baseResponse->getFile();
        $this->assertNotNull($file);
        $this->assertGreaterThan(100, $file->getSize());
    }

    public function test_reports_pack_includes_retirement_toil_visa_amendments(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeUser('Finance Controller', $tenant);

        $res = $this->asUser($finance)->getJson('/api/v1/travel/reports/pack')->assertOk();
        $data = $res->json('data');
        foreach ([
            'travel_register',
            'upcoming_travel',
            'current_travellers',
            'outstanding_retirement',
            'toil_candidates',
            'visa_status',
            'amendments',
            'cost_by_destination',
            'cost_by_traveller',
        ] as $key) {
            $this->assertArrayHasKey($key, $data, "Missing report key: {$key}");
        }
    }

    public function test_funding_lines_persist_payor_matrix_flags(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        $res = $this->asUser($staff)->postJson('/api/v1/travel/requests', [
            'purpose' => 'Mission funding matrix',
            'departure_date' => Carbon::now()->addDays(20)->toDateString(),
            'return_date' => Carbon::now()->addDays(25)->toDateString(),
            'destination_country' => 'Zambia',
            'funding_details' => [[
                'item' => 'Airfare',
                'forum_amount' => 1000,
                'host_amount' => 0,
                'payor_sadc_pf' => true,
                'payor_host' => false,
                'payor_donor' => false,
                'payor_self' => false,
                'funding_agency' => 'SADC PF',
            ]],
        ])->assertCreated();

        $id = $res->json('data.id');
        $this->assertDatabaseHas('travel_funding_lines', [
            'travel_request_id' => $id,
            'item' => 'Airfare',
            'payor_sadc_pf' => true,
            'payor_self' => false,
        ]);
    }

    public function test_toil_never_auto_creates_leave_still_locked(): void
    {
        $this->assertFalse(config('travel.auto_create_leave_from_travel'));
    }
}
