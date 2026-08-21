<?php

namespace App\Modules\Travel\Services;

use App\Models\TravelDestinationCity;
use App\Models\TravelDestinationCountry;
use App\Models\User;

class TravelDestinationCatalogService
{
    /** @var list<string> */
    public const SADC_COUNTRIES = [
        'Angola', 'Botswana', 'Comoros', 'Democratic Republic of Congo',
        'Eswatini', 'Lesotho', 'Madagascar', 'Malawi', 'Mauritius',
        'Mozambique', 'Namibia', 'Seychelles', 'South Africa', 'Tanzania',
        'Zambia', 'Zimbabwe',
    ];

    /** @var list<string> */
    public const OTHER_COUNTRIES = [
        'Belgium', 'China', 'Ethiopia', 'France', 'Germany', 'India', 'Italy',
        'Japan', 'Kenya', 'Nigeria', 'Rwanda', 'Spain', 'Switzerland', 'Uganda',
        'United Kingdom', 'United States',
    ];

    /** @var array<string, list<string>> */
    public const DEFAULT_CITIES = [
        'Angola' => ['Luanda'],
        'Belgium' => ['Brussels'],
        'Botswana' => ['Gaborone'],
        'Comoros' => ['Moroni'],
        'Democratic Republic of Congo' => ['Kinshasa'],
        'Eswatini' => ['Mbabane'],
        'Ethiopia' => ['Addis Ababa'],
        'Kenya' => ['Nairobi'],
        'Lesotho' => ['Maseru'],
        'Madagascar' => ['Antananarivo'],
        'Malawi' => ['Lilongwe'],
        'Mauritius' => ['Port Louis'],
        'Mozambique' => ['Maputo'],
        'Namibia' => ['Windhoek'],
        'Nigeria' => ['Abuja'],
        'Rwanda' => ['Kigali'],
        'Seychelles' => ['Victoria'],
        'South Africa' => ['Cape Town', 'Johannesburg', 'Pretoria'],
        'Switzerland' => ['Geneva'],
        'Tanzania' => ['Dar es Salaam'],
        'United Kingdom' => ['London'],
        'United States' => ['New York'],
        'Zambia' => ['Lusaka'],
        'Zimbabwe' => ['Harare'],
    ];

    /**
     * @return array{countries: list<array{id: int|null, name: string, is_sadc: bool, cities: list<array{id: int|null, name: string}>}>}
     */
    public function listForTenant(int $tenantId): array
    {
        $stored = TravelDestinationCountry::query()
            ->with(['cities' => fn ($q) => $q->orderBy('name')])
            ->where('tenant_id', $tenantId)
            ->orderBy('name')
            ->get();

        $byKey = [];

        foreach (self::SADC_COUNTRIES as $name) {
            $byKey[$this->key($name)] = [
                'id' => null,
                'name' => $name,
                'is_sadc' => true,
                'cities' => $this->defaultCityRows($name),
            ];
        }
        foreach (self::OTHER_COUNTRIES as $name) {
            $byKey[$this->key($name)] = [
                'id' => null,
                'name' => $name,
                'is_sadc' => false,
                'cities' => $this->defaultCityRows($name),
            ];
        }

        foreach ($stored as $country) {
            $key = $this->key((string) $country->name);
            $existing = $byKey[$key] ?? [
                'id' => null,
                'name' => $country->name,
                'is_sadc' => (bool) $country->is_sadc,
                'cities' => [],
            ];
            $cities = [];
            foreach ($existing['cities'] as $city) {
                $cities[$this->key($city['name'])] = $city;
            }
            foreach ($country->cities as $city) {
                $cities[$this->key((string) $city->name)] = [
                    'id' => $city->id,
                    'name' => $city->name,
                ];
            }
            usort($cities, fn (array $a, array $b) => strcasecmp($a['name'], $b['name']));
            $byKey[$key] = [
                'id' => $country->id,
                'name' => $country->name,
                'is_sadc' => $existing['is_sadc'] || (bool) $country->is_sadc,
                'cities' => array_values($cities),
            ];
        }

        $countries = array_values($byKey);
        usort($countries, function (array $a, array $b) {
            if ($a['is_sadc'] !== $b['is_sadc']) {
                return $a['is_sadc'] ? -1 : 1;
            }

            return strcasecmp($a['name'], $b['name']);
        });

        return ['countries' => $countries];
    }

    /**
     * @return array{created: bool, country: TravelDestinationCountry}
     */
    public function addCountry(User $user, string $name, ?bool $isSadc = null): array
    {
        $normalized = $this->canonicalCountryName($name);
        $existing = $this->findCountry((int) $user->tenant_id, $normalized);
        if ($existing) {
            return ['created' => false, 'country' => $existing];
        }

        $country = TravelDestinationCountry::query()->create([
            'tenant_id' => $user->tenant_id,
            'name' => $normalized,
            'is_sadc' => $isSadc ?? $this->isSadc($normalized),
            'created_by' => $user->id,
        ]);

        return ['created' => true, 'country' => $country];
    }

    /**
     * @return array{created: bool, city: TravelDestinationCity, country: TravelDestinationCountry}
     */
    public function addCity(User $user, string $countryName, string $cityName): array
    {
        $countryResult = $this->addCountry($user, $countryName);
        $country = $countryResult['country'];
        $normalizedCity = $this->canonicalPlaceName($cityName);

        $existing = TravelDestinationCity::query()
            ->where('tenant_id', $user->tenant_id)
            ->where('country_id', $country->id)
            ->whereRaw('LOWER(name) = ?', [$this->key($normalizedCity)])
            ->first();

        if ($existing) {
            return ['created' => false, 'city' => $existing, 'country' => $country];
        }

        $city = TravelDestinationCity::query()->create([
            'tenant_id' => $user->tenant_id,
            'country_id' => $country->id,
            'name' => $normalizedCity,
            'created_by' => $user->id,
        ]);

        return ['created' => true, 'city' => $city, 'country' => $country];
    }

    public function normalizeName(string $name): string
    {
        return trim(preg_replace('/\s+/', ' ', $name) ?? '');
    }

    private function findCountry(int $tenantId, string $name): ?TravelDestinationCountry
    {
        return TravelDestinationCountry::query()
            ->where('tenant_id', $tenantId)
            ->whereRaw('LOWER(name) = ?', [$this->key($name)])
            ->first();
    }

    private function canonicalCountryName(string $name): string
    {
        $normalized = $this->normalizeName($name);
        foreach ([...self::SADC_COUNTRIES, ...self::OTHER_COUNTRIES] as $canonical) {
            if (strcasecmp($canonical, $normalized) === 0) {
                return $canonical;
            }
        }

        return $this->canonicalPlaceName($normalized);
    }

    private function canonicalPlaceName(string $name): string
    {
        $normalized = $this->normalizeName($name);
        if ($normalized === '') {
            return $normalized;
        }

        return mb_strtoupper(mb_substr($normalized, 0, 1)).mb_substr($normalized, 1);
    }

    private function isSadc(string $name): bool
    {
        foreach (self::SADC_COUNTRIES as $canonical) {
            if (strcasecmp($canonical, $name) === 0) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return list<array{id: null, name: string}>
     */
    private function defaultCityRows(string $country): array
    {
        $cities = self::DEFAULT_CITIES[$country] ?? [];
        $rows = [];
        foreach ($cities as $city) {
            $rows[] = ['id' => null, 'name' => $city];
        }

        return $rows;
    }

    private function key(string $name): string
    {
        return mb_strtolower($this->normalizeName($name));
    }
}
