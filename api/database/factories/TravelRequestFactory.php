<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class TravelRequestFactory extends Factory
{
    public function definition(): array
    {
        $departure = now()->addDays(rand(7, 30));

        return [
            'tenant_id'           => Tenant::factory(),
            'requester_id'        => User::factory(),
            'reference_number'    => 'TRV-' . strtoupper(Str::random(8)),
            'purpose'             => fake()->sentence(),
            'status'              => 'draft',
            'departure_date'      => $departure->toDateString(),
            'return_date'         => $departure->copy()->addDays(3)->toDateString(),
            'destination_country' => fake()->country(),
            'destination_city'    => fake()->city(),
            'estimated_dsa'       => fake()->randomFloat(2, 500, 3000),
            'currency'            => 'USD',
        ];
    }

    public function submitted(): static
    {
        return $this->state(['status' => 'submitted', 'submitted_at' => now()]);
    }

    public function approved(): static
    {
        return $this->state(['status' => 'approved', 'submitted_at' => now(), 'approved_at' => now()]);
    }
}
