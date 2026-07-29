<?php

namespace Tests\Feature\Budget;

use App\Models\Tenant;
use Tests\TestCase;

class BudgetContributionScheduleTest extends TestCase
{
    public function test_create_schedule_and_upcoming_occurrences(): void
    {
        $tenant = Tenant::factory()->create();
        [$http] = $this->asAdmin($tenant);

        $row = $http->postJson('/api/v1/budget/contribution-schedules', [
            'donor_name' => 'EU Delegation',
            'source_type' => 'donor',
            'currency' => 'EUR',
            'amount' => 10000,
            'frequency' => 'quarterly',
            'start_date' => now()->startOfMonth()->toDateString(),
        ])->assertCreated()->json('data');

        $upcoming = $http->getJson('/api/v1/budget/contribution-schedules/'.$row['id'].'/upcoming?months=12')
            ->assertOk()
            ->json('data');

        $this->assertGreaterThanOrEqual(4, count($upcoming));
        $this->assertSame('EU Delegation', $upcoming[0]['donor_name']);
    }
}
