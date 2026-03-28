<?php

namespace Database\Factories;

use App\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

class ParliamentFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id'    => Tenant::factory(),
            'name'         => fake()->country() . ' Parliament',
            'country_code' => strtoupper(fake()->countryCode()),
            'country_name' => fake()->country(),
            'city'         => fake()->city(),
            'is_active'    => true,
        ];
    }
}
