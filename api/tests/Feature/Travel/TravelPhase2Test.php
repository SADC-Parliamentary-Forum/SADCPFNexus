<?php

namespace Tests\Feature\Travel;

use App\Models\Attachment;
use App\Models\Programme;
use App\Models\Tenant;
use App\Models\TravelMission;
use App\Models\TravelRequest;
use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use App\Modules\Travel\Contracts\FxRateFeedInterface;
use App\Modules\Travel\Services\TravelVisaReminderService;
use Carbon\Carbon;
use Tests\TestCase;

class TravelPhase2Test extends TestCase
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

    public function test_mission_readiness_matrix_reports_ticket_visa_hotel_dsa(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $viewer = $this->makeUser('Finance Controller', $tenant);

        $mission = TravelMission::create([
            'tenant_id' => $tenant->id,
            'title' => 'Harare Plenary',
            'destination_country' => 'Zimbabwe',
            'destination_city' => 'Harare',
            'start_date' => now()->addDays(10)->toDateString(),
            'end_date' => now()->addDays(14)->toDateString(),
            'created_by' => $staff->id,
        ]);

        $ready = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'mission_id' => $mission->id,
            'finance_status' => 'dsa_calculated',
            'finance_dsa_total' => 500,
            'visa_required' => true,
            'visa_status' => 'approved',
        ]);
        $this->attachDoc($ready, $staff->id, Attachment::DOCUMENT_TYPE_FLIGHT_TICKET);
        $this->attachDoc($ready, $staff->id, Attachment::DOCUMENT_TYPE_VISA_COPY);
        $this->attachDoc($ready, $staff->id, Attachment::DOCUMENT_TYPE_HOTEL_BOOKING);

        $incomplete = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'mission_id' => $mission->id,
            'status' => 'submitted',
            'visa_required' => true,
            'visa_status' => 'pending',
        ]);

        $list = $this->asUser($viewer)->getJson('/api/v1/travel/missions')->assertOk();
        $this->assertNotEmpty($list->json('data'));

        $show = $this->asUser($viewer)->getJson("/api/v1/travel/missions/{$mission->id}")->assertOk();
        $travellers = collect($show->json('data.travellers'));
        $this->assertCount(2, $travellers);

        $readyRow = $travellers->firstWhere('travel_request_id', $ready->id);
        $this->assertTrue($readyRow['ticket']);
        $this->assertTrue($readyRow['visa']);
        $this->assertTrue($readyRow['hotel']);
        $this->assertTrue($readyRow['dsa']);
        $this->assertTrue($readyRow['ready']);

        $incompleteRow = $travellers->firstWhere('travel_request_id', $incomplete->id);
        $this->assertFalse($incompleteRow['ticket']);
        $this->assertFalse($incompleteRow['visa']);
        $this->assertFalse($incompleteRow['hotel']);
        $this->assertFalse($incompleteRow['dsa']);
        $this->assertFalse($incompleteRow['ready']);
    }

    public function test_visa_update_and_reminder_watchlist(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);

        $this->asUser($admin)->patchJson("/api/v1/travel/requests/{$travel->id}/visa", [
            'visa_required' => true,
            'visa_status' => 'appointment_scheduled',
            'visa_appointment_date' => now()->addDays(3)->toDateString(),
            'visa_expiry_date' => now()->addDays(20)->toDateString(),
            'visa_notes' => 'Embassy appointment booked',
        ])->assertOk()
            ->assertJsonPath('data.visa_status', 'appointment_scheduled');

        $watch = $this->asUser($admin)->getJson('/api/v1/travel/visa-reminders')->assertOk();
        $ids = collect($watch->json('data'))->pluck('id');
        $this->assertTrue($ids->contains($travel->id));

        $sent = app(TravelVisaReminderService::class)->sendDueReminders($tenant->id);
        $this->assertGreaterThanOrEqual(1, $sent);
        $this->assertNotNull($travel->fresh()->visa_last_reminded_at);
    }

    public function test_travel_pdf_parts_a_d_download(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'purpose' => 'Regional meeting Phase 2',
            'finance_dsa_total' => 1200,
        ]);
        $travel->fundingLines()->create([
            'item' => 'Air tickets',
            'forum_amount' => 4000,
            'host_amount' => 0,
            'funding_agency' => 'SADC PF',
            'sort_order' => 0,
        ]);
        $travel->dsaLines()->create([
            'date' => $travel->departure_date,
            'destination' => $travel->destination_city,
            'rate_type' => 1,
            'daily_rate' => 200,
            'meal_deduction' => 0,
            'adjustments' => 0,
            'daily_payable' => 200,
            'is_personal' => false,
        ]);
        $travel->itineraries()->create([
            'from_location' => 'Windhoek',
            'to_location' => 'Harare',
            'travel_date' => $travel->departure_date->toDateString(),
            'transport_mode' => 'air',
            'day_type' => 'official',
        ]);

        $res = $this->asUser($finance)->get("/api/v1/travel/requests/{$travel->id}/pdf");
        $res->assertOk();
        $this->assertStringContainsString('application/pdf', $res->headers->get('content-type'));
        $this->assertGreaterThan(100, strlen($res->getContent()));
    }

    public function test_analytics_summary_groups_cost_by_programme_and_donor(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        $programme = Programme::create([
            'tenant_id' => $tenant->id,
            'created_by' => $staff->id,
            'reference_number' => 'PIF-P2-' . uniqid(),
            'title' => 'Phase 2 Programme',
            'status' => 'approved',
            'approved_at' => now(),
        ]);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'programme_id' => $programme->id,
            'finance_dsa_total' => 800,
            'estimated_dsa' => 700,
        ]);
        $travel->fundingLines()->create([
            'item' => 'DSA',
            'forum_amount' => 800,
            'host_amount' => 200,
            'funding_agency' => 'EU Donor',
            'sort_order' => 0,
        ]);

        $res = $this->asUser($finance)->getJson('/api/v1/travel/analytics/summary')->assertOk();
        $byProgramme = collect($res->json('data.cost_by_programme'));
        $this->assertTrue($byProgramme->contains(fn ($row) => (int) $row['programme_id'] === $programme->id));
        $byDonor = collect($res->json('data.cost_by_funding_agency'));
        $this->assertTrue($byDonor->contains(fn ($row) => ($row['funding_agency'] ?? '') === 'EU Donor'));
        $this->assertArrayHasKey('by_status', $res->json('data'));
    }

    public function test_airline_and_fx_stubs_are_bound_and_safe(): void
    {
        $parser = app(AirlineItineraryParserInterface::class);
        $fx = app(FxRateFeedInterface::class);

        $this->assertSame([], $parser->parse(''));
        $this->assertNull($fx->getRate('USD', 'NAD', Carbon::today()));
    }

    public function test_toil_reject_never_creates_leave(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $supervisor = $this->makeUser('HOD', $tenant);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);
        $candidate = \App\Models\TravelToilCandidate::create([
            'tenant_id' => $tenant->id,
            'travel_request_id' => $travel->id,
            'user_id' => $staff->id,
            'candidate_date' => now()->toDateString(),
            'hours' => 8,
            'reason' => 'weekend',
            'status' => \App\Models\TravelToilCandidate::STATUS_CANDIDATE,
        ]);

        $leaveBefore = \App\Models\LeaveRequest::count();
        $this->asUser($supervisor)->postJson("/api/v1/travel/toil/{$candidate->id}/reject", [
            'reason' => 'Duty not required',
        ])->assertOk();

        $this->assertSame($leaveBefore, \App\Models\LeaveRequest::count());
        $this->assertSame(
            \App\Models\TravelToilCandidate::STATUS_REJECTED,
            $candidate->fresh()->status
        );
    }
}
