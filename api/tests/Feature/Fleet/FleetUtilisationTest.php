<?php

namespace Tests\Feature\Fleet;

use App\Models\Asset;
use App\Models\FleetBooking;
use App\Models\FleetTripLog;
use App\Models\Tenant;
use Tests\TestCase;

class FleetUtilisationTest extends TestCase
{
    public function test_utilisation_report_counts_booking_days_and_km(): void
    {
        $tenant = Tenant::factory()->create();
        [$http, $user] = $this->asAdmin($tenant);

        $vehicle = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'FLT-'.uniqid(),
            'name' => 'Pool Car',
            'category' => 'fleet',
            'status' => 'active',
        ]);

        FleetBooking::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $vehicle->id,
            'requested_by' => $user->id,
            'starts_at' => now()->startOfDay(),
            'ends_at' => now()->startOfDay()->addDays(1),
            'status' => FleetBooking::CONFIRMED,
            'created_by' => $user->id,
        ]);

        FleetTripLog::create([
            'tenant_id' => $tenant->id,
            'asset_id' => $vehicle->id,
            'started_at' => now(),
            'start_odometer_km' => 1000,
            'end_odometer_km' => 1125,
            'distance_km' => 125,
            'created_by' => $user->id,
        ]);

        $from = now()->subDay()->toDateString();
        $to = now()->addDays(2)->toDateString();

        $data = $http->getJson("/api/v1/fleet/utilisation?from={$from}&to={$to}")
            ->assertOk()
            ->json('data');

        $row = collect($data['vehicles'])->firstWhere('asset_id', $vehicle->id);
        $this->assertNotNull($row);
        $this->assertGreaterThanOrEqual(2, (int) $row['booking_days']);
        $this->assertSame(125, (int) $row['km_travelled']);
    }
}