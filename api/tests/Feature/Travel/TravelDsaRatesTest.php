<?php

namespace Tests\Feature\Travel;

use App\Models\DsaRate;
use App\Models\Tenant;
use App\Models\TravelRequest;
use App\Models\User;
use App\Modules\Travel\Services\TravelDsaService;
use Tests\TestCase;

class TravelDsaRatesTest extends TestCase
{
    public function test_dsa_rates_store_and_list(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $finance] = $this->asFinanceController($tenant);

        $store = $http->postJson('/api/v1/travel/dsa-rates', [
            'country' => 'Namibia',
            'city' => 'Windhoek',
            'rate_type' => 1,
            'rate_per_day' => 165,
            'currency' => 'USD',
            'accommodation_component' => 99,
            'meal_component' => 49.5,
            'incidentals_component' => 16.5,
            'effective_from' => '2026-01-01',
            'is_active' => true,
        ]);

        $store->assertCreated()
            ->assertJsonPath('data.country', 'Namibia')
            ->assertJsonPath('data.city', 'Windhoek')
            ->assertJsonPath('data.rate_type', 1);

        $list = $http->getJson('/api/v1/travel/dsa-rates?per_page=10');
        $list->assertOk();
        $this->assertCount(1, $list->json('data'));
        $this->assertSame('Windhoek', $list->json('data.0.city'));
    }

    public function test_build_default_lines_prefers_city_rate_then_country_fallback(): void
    {
        $tenant = Tenant::factory()->create();
        $staff = $this->makeUser('staff', $tenant);

        DsaRate::create([
            'tenant_id' => $tenant->id,
            'country' => 'Namibia',
            'city' => null,
            'rate_type' => 1,
            'rate_per_day' => 120,
            'accommodation_component' => 72,
            'meal_component' => 36,
            'incidentals_component' => 12,
            'effective_from' => '2026-01-01',
            'is_active' => true,
            'currency' => 'USD',
            'version' => 1,
        ]);

        DsaRate::create([
            'tenant_id' => $tenant->id,
            'country' => 'Namibia',
            'city' => 'Windhoek',
            'rate_type' => 1,
            'rate_per_day' => 165,
            'accommodation_component' => 99,
            'meal_component' => 49.5,
            'incidentals_component' => 16.5,
            'effective_from' => '2026-01-01',
            'is_active' => true,
            'currency' => 'USD',
            'version' => 1,
        ]);

        $cityTravel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'destination_country' => 'Namibia',
            'destination_city' => 'Windhoek',
            'departure_date' => '2026-02-01',
            'return_date' => '2026-02-01',
        ]);

        $countryTravel = TravelRequest::factory()->create([
            'tenant_id' => $tenant->id,
            'requester_id' => $staff->id,
            'destination_country' => 'Namibia',
            'destination_city' => 'Swakopmund',
            'departure_date' => '2026-02-01',
            'return_date' => '2026-02-01',
        ]);

        $service = app(TravelDsaService::class);

        $cityLines = $service->buildDefaultLines($cityTravel, 1);
        $countryLines = $service->buildDefaultLines($countryTravel, 1);

        $this->assertSame(165.0, (float) $cityLines[0]['daily_rate']);
        $this->assertSame(120.0, (float) $countryLines[0]['daily_rate']);
    }
}
