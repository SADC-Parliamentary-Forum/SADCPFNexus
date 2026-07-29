<?php

namespace Tests\Feature\Fleet;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\FleetFuelLog;
use App\Models\FleetServiceSchedule;
use App\Models\FleetTripLog;
use App\Models\Tenant;
use Tests\TestCase;

class FleetFoundationPhase2Test extends TestCase
{
    private function makeFleetVehicle(Tenant $tenant): Asset
    {
        AssetCategory::firstOrCreate(
            ['tenant_id' => $tenant->id, 'code' => 'fleet'],
            ['name' => 'Fleet', 'sort_order' => 2]
        );

        return Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'FLT-'.uniqid(),
            'name' => 'Toyota Hilux',
            'category' => 'fleet',
            'status' => 'active',
        ]);
    }

    public function test_lists_only_fleet_category_assets(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $vehicle = $this->makeFleetVehicle($tenant);

        Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'IT-'.uniqid(),
            'name' => 'Laptop',
            'category' => 'it',
            'status' => 'active',
        ]);

        $data = $this->asUser($admin)
            ->getJson('/api/v1/fleet/vehicles')
            ->assertOk()
            ->json('data');

        $ids = collect($data)->pluck('id')->all();
        $this->assertContains($vehicle->id, $ids);
        $this->assertCount(1, $data);
    }

    public function test_can_log_trip_fuel_and_service_due(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $vehicle = $this->makeFleetVehicle($tenant);

        $trip = $this->asUser($admin)
            ->postJson("/api/v1/fleet/vehicles/{$vehicle->id}/trips", [
                'started_at' => '2026-07-20T08:00:00Z',
                'ended_at' => '2026-07-20T12:00:00Z',
                'start_odometer_km' => 10000,
                'end_odometer_km' => 10120,
                'purpose' => 'Airport transfer',
                'origin' => 'HQ',
                'destination' => 'Hosea Kutako',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame(120, (int) $trip['distance_km']);
        $this->assertDatabaseHas('fleet_trip_logs', [
            'asset_id' => $vehicle->id,
            'purpose' => 'Airport transfer',
        ]);

        $this->asUser($admin)
            ->postJson("/api/v1/fleet/vehicles/{$vehicle->id}/fuel-logs", [
                'logged_at' => '2026-07-20T13:00:00Z',
                'litres' => 45.5,
                'cost_amount' => 820.00,
                'odometer_km' => 10120,
                'station' => 'Engen',
            ])
            ->assertCreated();

        $this->assertDatabaseCount('fleet_fuel_logs', 1);

        $schedule = $this->asUser($admin)
            ->postJson("/api/v1/fleet/vehicles/{$vehicle->id}/service-schedules", [
                'service_type' => 'service',
                'interval_km' => 10000,
                'interval_days' => 180,
                'last_service_at' => '2026-01-01',
                'last_service_odometer_km' => 5000,
                'notes' => 'A-service',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertNotNull($schedule['next_due_at']);
        $this->assertSame(15000, (int) $schedule['next_due_odometer_km']);

        $detail = $this->asUser($admin)
            ->getJson("/api/v1/fleet/vehicles/{$vehicle->id}")
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $detail['trips']);
        $this->assertCount(1, $detail['fuel_logs']);
        $this->assertCount(1, $detail['service_schedules']);
        $this->assertTrue(FleetTripLog::query()->where('asset_id', $vehicle->id)->exists());
        $this->assertTrue(FleetFuelLog::query()->where('asset_id', $vehicle->id)->exists());
        $this->assertTrue(FleetServiceSchedule::query()->where('asset_id', $vehicle->id)->exists());
    }

    public function test_rejects_non_fleet_asset(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $it = Asset::create([
            'tenant_id' => $tenant->id,
            'asset_code' => 'IT-'.uniqid(),
            'name' => 'Laptop',
            'category' => 'it',
            'status' => 'active',
        ]);

        $this->asUser($admin)
            ->postJson("/api/v1/fleet/vehicles/{$it->id}/trips", [
                'started_at' => now()->toIso8601String(),
                'start_odometer_km' => 1,
                'purpose' => 'Nope',
            ])
            ->assertStatus(422);
    }
}
