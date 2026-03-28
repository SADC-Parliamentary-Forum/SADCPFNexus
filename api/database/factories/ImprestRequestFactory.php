<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class ImprestRequestFactory extends Factory
{
    public function definition(): array
    {
        return [
            'tenant_id'                  => Tenant::factory(),
            'requester_id'               => User::factory(),
            'reference_number'           => 'IRQ-' . strtoupper(Str::random(8)),
            'budget_line'                => 'Programme ' . fake()->numberBetween(1, 10) . ' — Activities',
            'amount_requested'           => fake()->randomFloat(2, 500, 5000),
            'currency'                   => 'USD',
            'expected_liquidation_date'  => now()->addDays(rand(14, 60))->toDateString(),
            'purpose'                    => fake()->sentence(),
            'justification'              => fake()->paragraph(),
            'status'                     => 'draft',
        ];
    }

    public function submitted(): static
    {
        return $this->state(['status' => 'submitted', 'submitted_at' => now()]);
    }

    public function approved(): static
    {
        return $this->state([
            'status'       => 'approved',
            'submitted_at' => now(),
            'approved_at'  => now(),
            'amount_approved' => fake()->randomFloat(2, 500, 5000),
        ]);
    }
}
