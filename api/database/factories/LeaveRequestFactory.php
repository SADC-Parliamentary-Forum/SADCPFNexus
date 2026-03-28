<?php

namespace Database\Factories;

use App\Models\Tenant;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

class LeaveRequestFactory extends Factory
{
    public function definition(): array
    {
        $start = now()->addDays(rand(5, 30));

        return [
            'tenant_id'      => Tenant::factory(),
            'requester_id'   => User::factory(),
            'reference_number' => 'LRQ-' . strtoupper(Str::random(8)),
            'leave_type'     => fake()->randomElement(['annual', 'sick', 'special']),
            'start_date'     => $start->toDateString(),
            'end_date'       => $start->copy()->addDays(2)->toDateString(),
            'days_requested' => 3,
            'reason'         => fake()->sentence(),
            'status'         => 'draft',
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
