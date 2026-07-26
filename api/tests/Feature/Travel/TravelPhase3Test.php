<?php

namespace Tests\Feature\Travel;

use App\Models\AuditLog;
use App\Models\ProcurementRequest;
use App\Models\Tenant;
use App\Models\TravelFxRate;
use App\Models\TravelItinerary;
use App\Models\TravelRequest;
use App\Modules\Travel\Contracts\AirlineItineraryParserInterface;
use App\Modules\Travel\Contracts\FxRateFeedInterface;
use Carbon\Carbon;
use Tests\TestCase;

class TravelPhase3Test extends TestCase
{
    public function test_practical_parser_extracts_structured_and_ics_legs(): void
    {
        $parser = app(AirlineItineraryParserInterface::class);

        $structured = $parser->parse(
            "Flight BA123 WDH-JNB 2026-08-10\nFlight BA124 JNB-WDH 2026-08-15"
        );
        $this->assertCount(2, $structured);
        $this->assertSame('WDH', $structured[0]['from_location']);
        $this->assertSame('JNB', $structured[0]['to_location']);
        $this->assertSame('BA123', $structured[0]['flight_number']);
        $this->assertSame('flight', $structured[0]['transport_mode']);

        $ics = $parser->parse(<<<ICS
BEGIN:VCALENDAR
BEGIN:VEVENT
DTSTART:20260810T080000Z
SUMMARY:Flight SA456 CPT to JNB
LOCATION:CPT
DESCRIPTION:Arrive JNB
END:VEVENT
END:VCALENDAR
ICS);
        $this->assertNotEmpty($ics);
        $this->assertSame([], $parser->parse(''));
        $this->assertSame([], $parser->parse('this is not an itinerary at all'));
    }

    public function test_parse_and_apply_itinerary_versions_legs_with_audit(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'draft',
            'itinerary_version' => 0,
        ]);
        TravelItinerary::create([
            'travel_request_id' => $travel->id,
            'from_location' => 'OLD',
            'to_location' => 'LEG',
            'travel_date' => now()->addDays(5)->toDateString(),
            'transport_mode' => 'flight',
            'days_count' => 1,
        ]);

        $raw = "Flight BA123 WDH-JNB 2026-08-10\nFlight BA124 JNB-WDH 2026-08-15";

        $preview = $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/parse-itinerary", [
            'raw_text' => $raw,
        ])->assertOk();
        $this->assertCount(2, $preview->json('data.legs'));
        $this->assertTrue($preview->json('data.parseable'));

        $soft = $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/parse-itinerary", [
            'raw_text' => 'garbage input with no flights',
        ])->assertOk();
        $this->assertFalse($soft->json('data.parseable'));
        $this->assertSame([], $soft->json('data.legs'));

        $this->asUser($admin)->postJson("/api/v1/travel/requests/{$travel->id}/apply-itinerary", [
            'raw_text' => $raw,
        ])->assertOk();

        $travel->refresh();
        $this->assertSame(1, (int) $travel->itinerary_version);
        $this->assertSame(2, $travel->itineraries()->count());
        $this->assertDatabaseMissing('travel_itineraries', [
            'travel_request_id' => $travel->id,
            'from_location' => 'OLD',
        ]);
        $this->assertTrue(
            AuditLog::query()->where('event', 'travel.itinerary_applied')->exists()
        );
    }

    public function test_fx_manual_rates_and_dsa_snapshot(): void
    {
        $tenant = Tenant::factory()->create();
        $finance = $this->makeUser('Finance Controller', $tenant);
        $staff = $this->makeUser('staff', $tenant);

        $this->asUser($finance)->postJson('/api/v1/travel/fx-rates', [
            'from_currency' => 'USD',
            'to_currency' => 'NAD',
            'rate' => 18.5,
            'effective_date' => now()->toDateString(),
            'source' => 'manual',
            'notes' => 'Admin table',
        ])->assertCreated();

        $fx = app(FxRateFeedInterface::class);
        $rate = $fx->getRate('USD', 'NAD', Carbon::today());
        $this->assertEqualsWithDelta(18.5, (float) $rate, 0.001);
        $this->assertNull($fx->getRate('EUR', 'JPY', Carbon::today()));

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'currency' => 'NAD',
            'destination_country' => 'Namibia',
            'departure_date' => now()->addDays(10)->toDateString(),
            'return_date' => now()->addDays(12)->toDateString(),
        ]);

        $res = $this->asUser($finance)->postJson("/api/v1/travel/requests/{$travel->id}/dsa", [
            'rate_type' => 1,
            'lines' => [
                [
                    'date' => $travel->departure_date->toDateString(),
                    'destination' => 'Windhoek',
                    'rate_type' => 1,
                    'daily_rate' => 100,
                    'meal_deduction' => 0,
                    'adjustments' => 0,
                    'is_personal' => false,
                    'fx_from_currency' => 'USD',
                    'fx_to_currency' => 'NAD',
                ],
            ],
            'terminal_comms_total' => 0,
        ])->assertOk();

        $line = $res->json('data.dsa_lines.0');
        $this->assertEqualsWithDelta(18.5, (float) $line['fx_rate'], 0.001);
        $this->assertSame('USD', $line['fx_from_currency']);
        $this->assertSame('NAD', $line['fx_to_currency']);
        $this->assertNotEmpty($line['fx_as_of']);
    }

    public function test_health_pack_restricted_visibility_and_pdf_section(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $peer = $this->makeUser('staff', $tenant);
        $hr = $this->makeUser('HR Manager', $tenant);

        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);

        $this->asUser($hr)->patchJson("/api/v1/travel/requests/{$travel->id}/health", [
            'health_vaccination_required' => true,
            'health_vaccination_status' => 'completed',
            'health_prophylaxis_required' => true,
            'health_prophylaxis_status' => 'prescribed',
            'health_estimated_cost' => 250.00,
            'health_notes' => 'Yellow fever + malaria',
        ])->assertOk();

        $ownerView = $this->asUser($staff)->getJson("/api/v1/travel/requests/{$travel->id}")->assertOk();
        $this->assertTrue($ownerView->json('data.health_vaccination_required'));
        $this->assertSame('completed', $ownerView->json('data.health_vaccination_status'));

        // Peer without health-view / privileged role should not see health fields
        $peer->givePermissionTo('travel.view');
        $peerView = $this->asUser($peer)->getJson("/api/v1/travel/requests/{$travel->id}");
        // Peer may be 403 on ownership OR 200 with redacted health — either is acceptable SoD
        if ($peerView->status() === 200) {
            $this->assertArrayNotHasKey('health_vaccination_status', $peerView->json('data') ?? []);
            $this->assertArrayNotHasKey('health_notes', $peerView->json('data') ?? []);
        } else {
            $peerView->assertForbidden();
        }

        $pdf = $this->asUser($hr)->get("/api/v1/travel/requests/{$travel->id}/pdf")->assertOk();
        $this->assertStringContainsString('application/pdf', (string) $pdf->headers->get('content-type'));
    }

    public function test_procurement_soft_link_fields(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $admin = $this->makeUser('Administration Officer', $tenant);

        $proc = ProcurementRequest::create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'title' => 'Mission flights booking',
            'description' => 'Soft link from travel',
            'category' => 'services',
            'estimated_value' => 25000,
            'currency' => 'NAD',
            'status' => 'draft',
        ]);

        $travel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'status' => 'draft',
            'estimated_dsa' => 500,
            'personal_incremental_cost' => 0,
        ]);

        $this->asUser($admin)->patchJson("/api/v1/travel/requests/{$travel->id}/procurement-link", [
            'procurement_request_id' => $proc->id,
            'procurement_link_reason' => 'Ticket value exceeds travel-agent threshold',
            'procurement_link_required' => true,
        ])->assertOk();

        $travel->refresh();
        $this->assertSame($proc->id, (int) $travel->procurement_request_id);
        $this->assertTrue((bool) $travel->procurement_link_required);

        $show = $this->asUser($staff)->getJson("/api/v1/travel/requests/{$travel->id}")->assertOk();
        $this->assertSame($proc->id, (int) $show->json('data.procurement_request_id'));
        $this->assertNotEmpty($show->json('data.procurement_request.reference_number'));

        $this->asUser($admin)->patchJson("/api/v1/travel/requests/{$travel->id}/procurement-link", [
            'procurement_request_id' => null,
            'procurement_link_required' => false,
        ])->assertOk();
        $this->assertNull($travel->fresh()->procurement_request_id);
    }

    public function test_phase1_locks_toil_never_auto_leave_and_finance_sod(): void
    {
        $this->assertFalse(config('travel.auto_create_leave_from_travel'));

        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $travel = TravelRequest::factory()->approved()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
        ]);

        $this->asUser($staff)->postJson("/api/v1/travel/requests/{$travel->id}/dsa", [
            'rate_type' => 1,
        ])->assertStatus(403);
    }
}
