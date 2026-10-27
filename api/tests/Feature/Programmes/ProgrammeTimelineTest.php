<?php

namespace Tests\Feature\Programmes;

use App\Models\ProcurementRequest;
use App\Models\Programme;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\User;
use Tests\TestCase;

/**
 * GET /programmes/{id}/timeline: linked records only when the caller can see
 * them in their own module; money never combined across currencies.
 */
class ProgrammeTimelineTest extends TestCase
{
    private Tenant $tenant;

    protected function setUp(): void
    {
        parent::setUp();
        $this->tenant = Tenant::factory()->create();
    }

    private function programme(User $owner): Programme
    {
        return Programme::create([
            'tenant_id' => $this->tenant->id, 'created_by' => $owner->id, 'reference_number' => 'PIF-TL-'.uniqid(),
            'title' => 'Timeline programme', 'status' => 'approved', 'total_budget' => 50000, 'primary_currency' => 'NAD',
        ]);
    }

    private function procurement(Programme $p, User $requester, float $value, string $currency): ProcurementRequest
    {
        return ProcurementRequest::create([
            'tenant_id' => $this->tenant->id, 'requester_id' => $requester->id, 'reference_number' => 'PRQ-TL-'.uniqid(),
            'title' => "Buy {$currency}", 'description' => 'Linked', 'status' => 'submitted', 'category' => 'goods',
            'estimated_value' => $value, 'currency' => $currency, 'programme_id' => $p->id,
        ]);
    }

    private function linkTravel(Programme $p, User $requester, string $purpose): TravelRequest
    {
        return TravelRequest::create([
            'tenant_id' => $this->tenant->id, 'requester_id' => $requester->id, 'reference_number' => 'TRV-TL-'.uniqid(),
            'destination_country' => 'Namibia', 'destination_city' => 'Windhoek', 'purpose' => $purpose,
            'departure_date' => now()->addDays(3)->toDateString(), 'return_date' => now()->addDays(5)->toDateString(),
            'currency' => 'NAD', 'status' => 'approved', 'programme_id' => $p->id,
        ]);
    }

    public function test_owner_sees_own_linked_records_but_not_a_colleagues(): void
    {
        [$http, $owner] = $this->asProgrammeOfficer($this->tenant);
        $colleague = $this->makeUser('staff', $this->tenant);
        $programme = $this->programme($owner);
        $mine = $this->linkTravel($programme, $owner, 'My mission');
        $this->linkTravel($programme, $colleague, 'Colleague private mission');

        $events = collect($http->getJson("/api/v1/programmes/{$programme->id}/timeline")->assertOk()->json('data.events'));

        $this->assertTrue($events->contains(fn ($e) => $e['type'] === 'programme' && $e['kind'] === 'created'));
        $this->assertTrue($events->contains(fn ($e) => $e['type'] === 'travel_request' && $e['id'] === $mine->id));
        $this->assertFalse($events->contains(fn ($e) => ($e['title'] ?? '') === 'Colleague private mission'),
            'a linked record the viewer cannot access leaked into the timeline');
    }

    public function test_amounts_are_grouped_by_currency_never_summed_across_currencies(): void
    {
        [$http, $owner] = $this->asProgrammeOfficer($this->tenant);
        $programme = $this->programme($owner);
        $this->procurement($programme, $owner, 1000, 'NAD');
        $this->procurement($programme, $owner, 250.50, 'NAD');
        $this->procurement($programme, $owner, 300, 'USD');

        $fin = $http->getJson("/api/v1/programmes/{$programme->id}/timeline")->assertOk()->json('data.financials');

        $this->assertEquals(1250.5, $fin['linked_values_by_currency']['NAD']['requested_procurement_estimate']);
        $this->assertEquals(300, $fin['linked_values_by_currency']['USD']['requested_procurement_estimate']);
        $this->assertSame('NAD', $fin['approved_budget']['currency']);
        $this->assertArrayHasKey('note', $fin['definitions']);
    }

    public function test_users_without_programme_access_and_other_tenants_are_denied(): void
    {
        [, $owner] = $this->asProgrammeOfficer($this->tenant);
        $programme = $this->programme($owner);

        // Either the endpoint PEP (403) or the timeline's own scope check (404) may deny first.
        $staff = $this->makeUser('staff', $this->tenant);
        $status = $this->actingAs($staff, 'sanctum')->getJson("/api/v1/programmes/{$programme->id}/timeline")->status();
        $this->assertContains($status, [403, 404]);

        $outsider = $this->makeAdmin(Tenant::factory()->create());
        $status = $this->actingAs($outsider, 'sanctum')->getJson("/api/v1/programmes/{$programme->id}/timeline")->status();
        $this->assertContains($status, [403, 404]);
    }
}
