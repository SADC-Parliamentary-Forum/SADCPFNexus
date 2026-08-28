<?php

namespace Tests\Feature\Programmes;

use App\Models\Programme;
use App\Models\Tenant;
use App\Models\TravelRequest;
use Tests\TestCase;

class ProgrammeTravelTransferTest extends TestCase
{
    public function test_send_to_travel_creates_one_draft_per_traveller(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $t1 = $this->makeUser('staff', $tenant);
        $t2 = $this->makeUser('staff', $tenant);

        $programme = Programme::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title' => 'Regional workshop',
            'status' => 'approved',
            'approved_at' => now(),
            'venue_country' => 'Zambia',
            'venue_city' => 'Lusaka',
            'start_date' => now()->addDays(20)->toDateString(),
            'end_date' => now()->addDays(23)->toDateString(),
        ]);

        $response = $http->postJson("/api/v1/programmes/{$programme->id}/send-to-travel", [
            'traveller_ids' => [$t1->id, $t2->id],
            'mission_title' => 'Lusaka workshop mission',
            'purpose' => 'Attend regional workshop',
        ]);

        $response->assertCreated();
        $this->assertCount(2, $response->json('data'));
        $this->assertEquals(2, TravelRequest::where('programme_id', $programme->id)->count());
        $this->assertDatabaseHas('travel_requests', [
            'programme_id' => $programme->id,
            'requester_id' => $t1->id,
            'status' => 'draft',
            'destination_country' => 'Zambia',
        ]);
        $this->assertDatabaseHas('travel_missions', [
            'title' => 'Lusaka workshop mission',
            'programme_id' => $programme->id,
        ]);
    }

    public function test_send_to_travel_rejects_non_approved_programme(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asProgrammeOfficer($tenant);
        $programme = Programme::create([
            'tenant_id' => $tenant->id,
            'created_by' => $user->id,
            'reference_number' => 'PIF-' . uniqid(),
            'title' => 'Draft PIF',
            'status' => 'draft',
        ]);

        $http->postJson("/api/v1/programmes/{$programme->id}/send-to-travel", [
            'traveller_ids' => [$user->id],
        ])->assertUnprocessable();
    }
}
