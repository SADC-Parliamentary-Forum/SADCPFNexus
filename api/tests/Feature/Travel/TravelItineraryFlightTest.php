<?php

namespace Tests\Feature\Travel;

use Tests\TestCase;

class TravelItineraryFlightTest extends TestCase
{
    private function travelPayload(array $overrides = []): array
    {
        return array_merge([
            'purpose'             => 'Regional plenary with a flight hop',
            'departure_date'      => now()->addDays(7)->toDateString(),
            'return_date'         => now()->addDays(10)->toDateString(),
            'destination_country' => 'South Africa',
            'destination_city'    => 'Johannesburg',
            'currency'            => 'NAD',
        ], $overrides);
    }

    public function test_staff_can_save_flight_name_and_number_on_an_itinerary_leg(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'itineraries' => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Johannesburg, South Africa',
                    'travel_date'    => now()->addDays(7)->toDateString(),
                    'transport_mode' => 'flight',
                    'days_count'     => 1,
                    'flight_name'    => 'Air Namibia',
                    'flight_number'  => 'SW 287',
                ],
            ],
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.itineraries.0.flight_name', 'Air Namibia')
            ->assertJsonPath('data.itineraries.0.flight_number', 'SW 287');

        $id = $response->json('data.id');
        $this->assertDatabaseHas('travel_itineraries', [
            'travel_request_id' => $id,
            'flight_name'       => 'Air Namibia',
            'flight_number'     => 'SW 287',
        ]);

        $show = $http->getJson("/api/v1/travel/requests/{$id}");
        $show->assertOk()
            ->assertJsonPath('data.itineraries.0.flight_name', 'Air Namibia')
            ->assertJsonPath('data.itineraries.0.flight_number', 'SW 287');
    }

    public function test_omitted_flight_name_and_number_stay_null(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'itineraries' => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Johannesburg, South Africa',
                    'travel_date'    => now()->addDays(7)->toDateString(),
                    'transport_mode' => 'flight',
                    'days_count'     => 1,
                ],
            ],
        ]));

        $response->assertCreated();
        $leg = $response->json('data.itineraries.0');
        $this->assertArrayHasKey('flight_name', $leg);
        $this->assertArrayHasKey('flight_number', $leg);
        $this->assertNull($leg['flight_name']);
        $this->assertNull($leg['flight_number']);
    }

    public function test_non_flight_modes_can_still_store_flight_fields_when_provided(): void
    {
        [$http] = $this->asStaff();

        $response = $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'itineraries' => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Gaborone, Botswana',
                    'travel_date'    => now()->addDays(7)->toDateString(),
                    'transport_mode' => 'road',
                    'days_count'     => 1,
                    'flight_name'    => 'Namibia Shuttle',
                    'flight_number'  => 'BUS-04',
                ],
            ],
        ]));

        $response->assertCreated()
            ->assertJsonPath('data.itineraries.0.transport_mode', 'road')
            ->assertJsonPath('data.itineraries.0.flight_name', 'Namibia Shuttle')
            ->assertJsonPath('data.itineraries.0.flight_number', 'BUS-04');
    }

    public function test_update_persists_flight_name_and_number(): void
    {
        [$http] = $this->asStaff();

        $create = $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'itineraries' => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Johannesburg, South Africa',
                    'travel_date'    => now()->addDays(7)->toDateString(),
                    'transport_mode' => 'flight',
                    'days_count'     => 1,
                ],
            ],
        ]));
        $create->assertCreated();
        $id = $create->json('data.id');

        $http->putJson("/api/v1/travel/requests/{$id}", [
            'itineraries' => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Johannesburg, South Africa',
                    'travel_date'    => now()->addDays(7)->toDateString(),
                    'transport_mode' => 'flight',
                    'days_count'     => 1,
                    'flight_name'    => 'South African Airways',
                    'flight_number'  => 'SA 71',
                ],
            ],
        ])->assertOk()
            ->assertJsonPath('data.itineraries.0.flight_name', 'South African Airways')
            ->assertJsonPath('data.itineraries.0.flight_number', 'SA 71');
    }

    public function test_flight_name_and_number_reject_overlong_values(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/requests', $this->travelPayload([
            'itineraries' => [
                [
                    'from_location'  => 'Windhoek, Namibia',
                    'to_location'    => 'Johannesburg, South Africa',
                    'travel_date'    => now()->addDays(7)->toDateString(),
                    'transport_mode' => 'flight',
                    'flight_name'    => str_repeat('A', 121),
                    'flight_number'  => str_repeat('1', 33),
                ],
            ],
        ]))->assertUnprocessable()
            ->assertJsonValidationErrors(['itineraries.0.flight_name', 'itineraries.0.flight_number']);
    }
}
