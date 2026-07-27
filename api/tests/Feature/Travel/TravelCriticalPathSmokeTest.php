<?php

namespace Tests\Feature\Travel;

use App\Models\DsaRate;
use App\Models\Tenant;
use App\Models\TravelRequest;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

/**
 * End-to-end smoke: create → multipart attach → submit → approve → finance DSA.
 * Guards against regressions that 422/crash the requisition path in production.
 */
class TravelCriticalPathSmokeTest extends TestCase
{
    private function travelPayload(array $overrides = []): array
    {
        return array_merge([
            'purpose'             => 'Critical path smoke mission',
            'departure_date'      => now()->addDays(14)->toDateString(),
            'return_date'         => now()->addDays(17)->toDateString(),
            'destination_country' => 'Namibia',
            'destination_city'    => 'Windhoek',
            'estimated_dsa'       => 900.00,
            'currency'            => 'NAD',
            'itineraries'         => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Gaborone, Botswana',
                    'travel_date'    => now()->addDays(14)->toDateString(),
                    'transport_mode' => 'flight',
                    'days_count'     => 3,
                    'dsa_rate'       => 0,
                ],
            ],
            'funding_details' => [
                [
                    'item'         => 'Per Diems',
                    'forum_amount' => 900,
                    'host_amount'  => 0,
                    'payor_sadc_pf' => true,
                ],
            ],
        ], $overrides);
    }

    public function test_create_attach_submit_approve_finance_path(): void
    {
        Storage::fake('local');
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);
        $sg = $this->makeUser('Secretary General', $tenant);
        $finance = $this->makeUser('Finance Controller', $tenant);

        DsaRate::create([
            'tenant_id' => $tenant->id,
            'country' => 'Namibia',
            'city' => 'Windhoek',
            'rate_type' => 1,
            'rate_per_day' => 150,
            'accommodation_component' => 80,
            'meal_component' => 50,
            'incidentals_component' => 20,
            'is_active' => true,
            'currency' => 'NAD',
        ]);

        $http = $this->asUser($staff);

        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $create->assertCreated()->assertJsonPath('data.status', 'draft');
        $id = $create->json('data.id');
        $this->assertNotEmpty($id);

        foreach (['invitation', 'agenda'] as $type) {
            $http->post("/api/v1/travel/requests/{$id}/attachments", [
                'file' => $this->fakePdf("{$type}.pdf"),
                'document_type' => $type,
            ], ['Accept' => 'application/json'])
                ->assertCreated()
                ->assertJsonPath('data.document_type', $type);
        }

        $http->postJson("/api/v1/travel/requests/{$id}/submit")
            ->assertOk()
            ->assertJsonPath('data.status', 'submitted');

        $this->asUser($sg)->postJson("/api/v1/travel/requests/{$id}/approve")
            ->assertOk()
            ->assertJsonPath('data.status', 'approved');

        $dsa = $this->asUser($finance)->postJson("/api/v1/travel/requests/{$id}/dsa", [
            'rate_type' => 1,
            'terminal_comms_total' => 25,
        ]);
        $dsa->assertOk();
        $this->assertNotNull($dsa->json('data.finance_dsa_total'));
        $this->assertGreaterThan(0, (float) $dsa->json('data.finance_dsa_total'));

        $show = $this->asUser($staff)->getJson("/api/v1/travel/requests/{$id}")->assertOk();
        $this->assertSame('approved', $show->json('data.status'));
        $this->assertIsArray($show->json('data.itineraries'));
    }

    public function test_draft_update_can_replace_itineraries(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asStaff($tenant);

        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload());
        $id = $create->json('data.id');

        $http->putJson("/api/v1/travel/requests/{$id}", [
            'purpose' => 'Updated purpose after edit wizard',
            'departure_date' => now()->addDays(20)->toDateString(),
            'return_date' => now()->addDays(22)->toDateString(),
            'destination_country' => 'Botswana',
            'destination_city' => 'Gaborone',
            'itineraries' => [
                [
                    'from_location' => 'Gaborone, Botswana',
                    'to_location' => 'Windhoek, Namibia',
                    'travel_date' => now()->addDays(20)->toDateString(),
                    'transport_mode' => 'road',
                    'days_count' => 2,
                    'dsa_rate' => 0,
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.purpose', 'Updated purpose after edit wizard')
            ->assertJsonPath('data.destination_country', 'Botswana');

        $travel = TravelRequest::findOrFail($id);
        $this->assertCount(1, $travel->itineraries);
        $this->assertSame('road', $travel->itineraries->first()->transport_mode);
        $this->assertSame('Gaborone, Botswana', $travel->itineraries->first()->from_location);
    }
}
