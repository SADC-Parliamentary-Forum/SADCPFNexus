<?php

namespace Database\Seeders;

use App\Models\DsaRate;
use App\Models\Tenant;
use Illuminate\Database\Seeder;

/**
 * Reference DSA rates for travel calculations (UN-style rate types 1/2/3).
 * Safe to re-run — keyed on tenant, country, city, rate_type, version.
 */
class DsaRateSeeder extends Seeder
{
    private const EFFECTIVE_FROM = '2026-01-01';

    public function run(): void
    {
        $tenant = Tenant::where('slug', 'sadcpf')->first();
        if (! $tenant) {
            return;
        }

        foreach ($this->destinations() as $destination) {
            foreach ($this->rateTypesFor((float) $destination['type1_total']) as $rateType => $components) {
                DsaRate::updateOrCreate(
                    [
                        'tenant_id' => $tenant->id,
                        'country'   => $destination['country'],
                        'city'      => $destination['city'],
                        'rate_type' => $rateType,
                        'version'   => 1,
                    ],
                    [
                        'rate_per_day'            => $components['rate_per_day'],
                        'currency'                => 'USD',
                        'accommodation_component' => $components['accommodation'],
                        'meal_component'          => $components['meal'],
                        'incidentals_component'   => $components['incidentals'],
                        'effective_from'          => self::EFFECTIVE_FROM,
                        'effective_to'            => null,
                        'is_active'               => true,
                    ]
                );
            }
        }
    }

    /**
     * @return list<array{country: string, city: string, type1_total: float}>
     */
    private function destinations(): array
    {
        return [
            ['country' => 'Namibia', 'city' => 'Windhoek', 'type1_total' => 165.00],
            ['country' => 'Zambia', 'city' => 'Lusaka', 'type1_total' => 180.00],
            ['country' => 'Botswana', 'city' => 'Gaborone', 'type1_total' => 175.00],
            ['country' => 'South Africa', 'city' => 'Johannesburg', 'type1_total' => 220.00],
            ['country' => 'South Africa', 'city' => 'Pretoria', 'type1_total' => 210.00],
            ['country' => 'Zimbabwe', 'city' => 'Harare', 'type1_total' => 170.00],
            ['country' => 'Mozambique', 'city' => 'Maputo', 'type1_total' => 165.00],
            ['country' => 'Tanzania', 'city' => 'Dar es Salaam', 'type1_total' => 195.00],
            ['country' => 'Kenya', 'city' => 'Nairobi', 'type1_total' => 230.00],
        ];
    }

    /**
     * @return array<int, array{rate_per_day: float, accommodation: float, meal: float, incidentals: float}>
     */
    private function rateTypesFor(float $type1Total): array
    {
        $acc = round($type1Total * 0.60, 2);
        $meal = round($type1Total * 0.30, 2);
        $inc = round($type1Total - $acc - $meal, 2);

        $type2Total = round($meal + $inc, 2);
        $type3Total = $inc;

        return [
            1 => [
                'rate_per_day' => $type1Total,
                'accommodation' => $acc,
                'meal' => $meal,
                'incidentals' => $inc,
            ],
            2 => [
                'rate_per_day' => $type2Total,
                'accommodation' => 0,
                'meal' => $meal,
                'incidentals' => $inc,
            ],
            3 => [
                'rate_per_day' => $type3Total,
                'accommodation' => 0,
                'meal' => 0,
                'incidentals' => $inc,
            ],
        ];
    }
}
