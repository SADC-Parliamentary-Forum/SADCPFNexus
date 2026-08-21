<?php

namespace Tests\Feature\Travel;

use App\Models\TravelDestinationCountry;
use Tests\TestCase;

class TravelDestinationCatalogTest extends TestCase
{
    public function test_unauthenticated_cannot_list_destinations(): void
    {
        $this->getJson('/api/v1/travel/destinations')->assertUnauthorized();
    }

    public function test_staff_can_list_builtin_sadc_countries_and_cities(): void
    {
        [$http] = $this->asStaff();

        $response = $http->getJson('/api/v1/travel/destinations');

        $response->assertOk();
        $countries = collect($response->json('data.countries'));
        $namibia = $countries->firstWhere('name', 'Namibia');
        $this->assertNotNull($namibia);
        $this->assertTrue((bool) $namibia['is_sadc']);
        $this->assertTrue(
            collect($namibia['cities'])->contains(fn (array $city) => $city['name'] === 'Windhoek')
        );
    }

    public function test_staff_can_add_a_country_missing_from_the_dropdown(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/destinations/countries', ['name' => 'Ghana'])
            ->assertCreated()
            ->assertJsonPath('data.name', 'Ghana');

        $names = collect($http->getJson('/api/v1/travel/destinations')->json('data.countries'))->pluck('name');
        $this->assertTrue($names->contains('Ghana'));
    }

    public function test_adding_an_existing_country_is_idempotent(): void
    {
        [$http] = $this->asStaff();

        $first = $http->postJson('/api/v1/travel/destinations/countries', ['name' => 'Ghana']);
        $second = $http->postJson('/api/v1/travel/destinations/countries', ['name' => 'ghana']);

        $first->assertCreated();
        $this->assertContains($second->status(), [200, 201]);
        $this->assertSame($first->json('data.id'), $second->json('data.id'));
        $this->assertSame(1, TravelDestinationCountry::query()->count());
    }

    public function test_staff_can_add_a_city_under_a_country(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/destinations/cities', [
            'country' => 'Namibia',
            'name' => 'Swakopmund',
        ])->assertCreated()->assertJsonPath('data.name', 'Swakopmund');

        $namibia = collect($http->getJson('/api/v1/travel/destinations')->json('data.countries'))
            ->firstWhere('name', 'Namibia');
        $cityNames = collect($namibia['cities'])->pluck('name');
        $this->assertTrue($cityNames->contains('Swakopmund'));
        $this->assertTrue($cityNames->contains('Windhoek'));
    }

    public function test_adding_a_city_creates_the_country_when_missing(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/destinations/cities', [
            'country' => 'Ghana',
            'name' => 'Accra',
        ])->assertCreated();

        $ghana = collect($http->getJson('/api/v1/travel/destinations')->json('data.countries'))
            ->firstWhere('name', 'Ghana');
        $this->assertNotNull($ghana);
        $this->assertTrue(collect($ghana['cities'])->contains(fn (array $city) => $city['name'] === 'Accra'));
    }

    public function test_added_destinations_are_tenant_scoped(): void
    {
        [$httpA] = $this->asStaff();
        $httpA->postJson('/api/v1/travel/destinations/countries', ['name' => 'Ghana'])->assertCreated();

        [$httpB] = $this->asStaff();
        $names = collect($httpB->getJson('/api/v1/travel/destinations')->json('data.countries'))->pluck('name');
        $this->assertFalse($names->contains('Ghana'));
    }

    public function test_empty_country_or_city_name_is_rejected(): void
    {
        [$http] = $this->asStaff();

        $http->postJson('/api/v1/travel/destinations/countries', ['name' => '  '])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['name']);

        $http->postJson('/api/v1/travel/destinations/cities', [
            'country' => 'Namibia',
            'name' => '',
        ])->assertUnprocessable()->assertJsonValidationErrors(['name']);
    }
}
