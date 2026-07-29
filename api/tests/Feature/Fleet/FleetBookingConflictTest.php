<?php

namespace Tests\Feature\Fleet;

use App\Models\Asset;
use App\Models\AssetCategory;
use App\Models\Tenant;
use Tests\TestCase;

class FleetBookingConflictTest extends TestCase
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

    public function test_overlapping_booking_is_rejected(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $vehicle = $this->makeFleetVehicle($tenant);

        $this->asUser($admin)
            ->postJson('/api/v1/fleet/bookings', [
                'asset_id' => $vehicle->id,
                'starts_at' => '2026-08-10T08:00:00Z',
                'ends_at' => '2026-08-10T12:00:00Z',
                'purpose' => 'Airport run',
            ])
            ->assertCreated();

        $this->asUser($admin)
            ->postJson('/api/v1/fleet/bookings', [
                'asset_id' => $vehicle->id,
                'starts_at' => '2026-08-10T10:00:00Z',
                'ends_at' => '2026-08-10T14:00:00Z',
                'purpose' => 'Conflict',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['starts_at']);
    }

    public function test_non_overlapping_booking_is_allowed(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $vehicle = $this->makeFleetVehicle($tenant);

        $this->asUser($admin)
            ->postJson('/api/v1/fleet/bookings', [
                'asset_id' => $vehicle->id,
                'starts_at' => '2026-08-10T08:00:00Z',
                'ends_at' => '2026-08-10T12:00:00Z',
                'purpose' => 'Morning',
            ])
            ->assertCreated();

        $this->asUser($admin)
            ->postJson('/api/v1/fleet/bookings', [
                'asset_id' => $vehicle->id,
                'starts_at' => '2026-08-10T12:00:00Z',
                'ends_at' => '2026-08-10T16:00:00Z',
                'purpose' => 'Afternoon',
            ])
            ->assertCreated();

        $this->asUser($admin)
            ->getJson('/api/v1/fleet/bookings?from=2026-08-10&to=2026-08-11')
            ->assertOk()
            ->assertJsonCount(2, 'data');
    }

    public function test_can_manage_drivers_roster(): void
    {
        $tenant = Tenant::factory()->create();
        $admin = $this->makeAdmin($tenant);
        $driverUser = \App\Models\User::factory()->create(['tenant_id' => $tenant->id]);

        $driver = $this->asUser($admin)
            ->postJson('/api/v1/fleet/drivers', [
                'user_id' => $driverUser->id,
                'licence_number' => 'LIC-001',
                'licence_expires_on' => '2027-01-01',
                'status' => 'active',
            ])
            ->assertCreated()
            ->json('data');

        $this->assertSame('LIC-001', $driver['licence_number']);

        $list = $this->asUser($admin)
            ->getJson('/api/v1/fleet/drivers')
            ->assertOk()
            ->json('data');

        $this->assertCount(1, $list);
    }
}
